// Outils de dates pour l'agenda (heure locale du téléphone).
import type { CalendarEvent } from './database.types';

export const DAY_MS = 86_400_000;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** Lundi de la semaine de `d`. */
export function startOfWeek(d: Date) {
  const day = startOfDay(d);
  const offset = (day.getDay() + 6) % 7; // lundi = 0
  return addDays(day, -offset);
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "2026-10-15" (clé de jour locale, aussi utilisée dans les liens). */
export function dayKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

export function parseDayKey(key: string | undefined | null): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DOW_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
export const dowShort = (d: Date) => DOW_SHORT[d.getDay()];

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
const monthYearFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dayLongFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShortFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** "Octobre" (ou "Octobre 2027" hors année en cours). */
export function monthTitle(d: Date) {
  return capitalize((d.getFullYear() === new Date().getFullYear() ? monthFmt : monthYearFmt).format(d));
}

/** "Aujourd'hui · jeudi 15", "Demain · vendredi 16", "Samedi 17 octobre". */
export function daySectionTitle(d: Date) {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / DAY_MS);
  const short = `${new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d)} ${d.getDate()}`;
  if (diff === 0) return `Aujourd'hui · ${short}`;
  if (diff === 1) return `Demain · ${short}`;
  if (diff === -1) return `Hier · ${short}`;
  return capitalize(dayLongFmt.format(d));
}

export function formatHour(d: Date) {
  return timeFmt.format(d);
}

/** "jeu. 15 oct. · 19:30" ou "jeu. 15 oct. · toute la journée". */
export function formatEventWhen(startsAt: string, allDay: boolean) {
  const d = new Date(startsAt);
  return `${dayShortFmt.format(d)} · ${allDay ? 'toute la journée' : formatHour(d)}`;
}

/** Un événement touche-t-il ce jour ? (gère ceux qui débordent sur plusieurs jours) */
export function occursOn(e: Pick<CalendarEvent, 'starts_at' | 'ends_at'>, day: Date) {
  const start = new Date(e.starts_at).getTime();
  const end = e.ends_at ? new Date(e.ends_at).getTime() : start;
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + DAY_MS;
  return start < dayEnd && end >= dayStart;
}

/** Heure de déclenchement du rappel, ou null. Journée entière : référence 9 h le jour même. */
export function reminderDate(e: Pick<CalendarEvent, 'starts_at' | 'all_day' | 'reminder_minutes'>): Date | null {
  if (e.reminder_minutes == null) return null;
  const start = new Date(e.starts_at);
  const base = e.all_day ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0) : start;
  return new Date(base.getTime() - e.reminder_minutes * 60_000);
}

export const REMINDER_OPTIONS_TIMED: { label: string; value: number | null }[] = [
  { label: 'Aucun', value: null },
  { label: "À l'heure", value: 0 },
  { label: '15 min avant', value: 15 },
  { label: '1 h avant', value: 60 },
  { label: 'La veille', value: 1440 },
];

export const REMINDER_OPTIONS_ALL_DAY: { label: string; value: number | null }[] = [
  { label: 'Aucun', value: null },
  { label: 'Le jour même, 9 h', value: 0 },
  { label: 'La veille, 9 h', value: 1440 },
  { label: '1 semaine avant', value: 10080 },
];

export const DURATION_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'Sans fin', minutes: null },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '1 h 30', minutes: 90 },
  { label: '2 h', minutes: 120 },
  { label: '3 h', minutes: 180 },
];
