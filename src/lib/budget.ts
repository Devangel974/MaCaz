// Budget du foyer : catégories, montants (en centimes) et mois.
import { colors } from '@/theme';

import type { BudgetCategory, BudgetOperation, BudgetRecurring, OperationKind } from './database.types';

export type CategoryInfo = { id: BudgetCategory; label: string; emoji: string; color: string };

export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  { id: 'courses', label: 'Courses', emoji: '🥑', color: colors.sun },
  { id: 'logement', label: 'Logement', emoji: '🏠', color: colors.lagoon },
  { id: 'factures', label: 'Factures', emoji: '💡', color: '#FFE39A' },
  { id: 'transport', label: 'Transport', emoji: '🚗', color: colors.mute },
  { id: 'sorties', label: 'Sorties & restos', emoji: '🍽️', color: colors.coral },
  { id: 'sante', label: 'Santé', emoji: '💊', color: '#D3F3F1' },
  { id: 'abonnements', label: 'Abonnements', emoji: '📺', color: '#B9A8FF' },
  { id: 'shopping', label: 'Shopping', emoji: '👕', color: '#FFE1D9' },
  { id: 'autre', label: 'Autre', emoji: '✨', color: colors.lineSoft },
];

export const INCOME_CATEGORIES: CategoryInfo[] = [
  { id: 'salaire', label: 'Salaire', emoji: '💼', color: colors.lime },
  { id: 'aides', label: 'Aides (CAF…)', emoji: '🤝', color: '#E4F7DA' },
  { id: 'remboursement', label: 'Remboursement', emoji: '↩️', color: '#D3F3F1' },
  { id: 'autre_revenu', label: 'Autre revenu', emoji: '✨', color: colors.lineSoft },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
export const categoryInfo = (id: BudgetCategory): CategoryInfo => ALL.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[8];
export const categoriesFor = (kind: OperationKind) => (kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

// ------------------------------------------------------------------ Montants

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const euroRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** 3590 → "35,90 €" */
export const formatEuro = (cents: number) => euro.format(cents / 100);
/** 267120 → "2 671 €" */
export const formatEuroRound = (cents: number) => euroRound.format(cents / 100);
/** Avec signe : "−35,90 €" / "+1 820,00 €" */
export const formatSigned = (cents: number, kind: OperationKind) =>
  `${kind === 'income' ? '+' : '−'}${euro.format(cents / 100)}`;
/** Solde avec signe (+ / −). */
export const formatBalance = (cents: number) => `${cents >= 0 ? '+' : '−'}${euro.format(Math.abs(cents) / 100)}`;

/** "35,90" / "35.9" / "1 820" → centimes (null si invalide). */
export function parseAmount(s: string): number | null {
  const clean = s.replace(/[\s €]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 && cents < 100_000_000 ? cents : null;
}

/** Saisie : chiffres et une seule virgule, 2 décimales max. */
export function maskAmount(s: string) {
  const v = s.replace('.', ',').replace(/[^\d,]/g, '');
  const [int, ...rest] = v.split(',');
  return rest.length ? `${int.slice(0, 7)},${rest.join('').slice(0, 2)}` : int.slice(0, 7);
}

/** 3590 → "35,90" (pour pré-remplir le champ). */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');

// ------------------------------------------------------------------ Mois

/** "2026-10" */
export type MonthKey = string;

export const monthKeyOf = (d: Date): MonthKey => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthKeyOfDate = (iso: string): MonthKey => iso.slice(0, 7);
export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}
export function monthDate(key: MonthKey) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
}
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
const monthYearFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
/** "octobre" (année courante) ou "octobre 2025". */
export function monthLabel(key: MonthKey) {
  const d = monthDate(key);
  return d.getFullYear() === new Date().getFullYear() ? monthFmt.format(d) : monthYearFmt.format(d);
}
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-10-17" → Date locale */
export function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const toDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

// ------------------------------------------------------------------ Résumé du mois

export type MonthSummary = {
  income: number;
  expense: number;
  balance: number;
  byCategory: { info: CategoryInfo; cents: number; pct: number }[];
  ops: BudgetOperation[];
};

export function summarize(operations: BudgetOperation[], key: MonthKey): MonthSummary {
  const ops = operations.filter((o) => monthKeyOfDate(o.op_date) === key);
  let income = 0;
  let expense = 0;
  const cats = new Map<BudgetCategory, number>();
  for (const o of ops) {
    if (o.kind === 'income') income += o.amount_cents;
    else {
      expense += o.amount_cents;
      cats.set(o.category, (cats.get(o.category) ?? 0) + o.amount_cents);
    }
  }
  const byCategory = [...cats.entries()]
    .map(([id, cents]) => ({ info: categoryInfo(id), cents, pct: expense ? Math.round((cents / expense) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents);
  return { income, expense, balance: income - expense, byCategory, ops };
}

/** Prochaine date d'une récurrence (jour 31 → dernier jour du mois). */
export function nextDue(r: Pick<BudgetRecurring, 'next_month' | 'day_of_month'>) {
  const m = parseDay(r.next_month);
  const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  return new Date(m.getFullYear(), m.getMonth(), Math.min(r.day_of_month, last));
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
export const formatDayLong = (d: Date) => capitalize(dayFmt.format(d));
export const formatDayShort = (d: Date) => shortDayFmt.format(d);

/** "aujourd'hui", "demain", "le 17" */
export function relativeDue(d: Date) {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((d.getTime() - t) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  return `le ${d.getDate()}`;
}

/** "d'octobre", "de mars" */
export function ofMonth(key: MonthKey) {
  const l = monthLabel(key);
  return /^[aeiouy]/i.test(l) ? `d’${l}` : `de ${l}`;
}
