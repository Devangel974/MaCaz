// Papiers : types, échéances, fabrication du PDF et fichiers locaux.
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { PDFDocument } from 'pdf-lib';

import { colors } from '@/theme';

import { DAY_MS, startOfDay } from './calendar';
import type { DocType, HouseDocument } from './database.types';

export const DOC_TYPES: { id: DocType; label: string; defaultTitle: string }[] = [
  { id: 'passeport', label: 'Passeport', defaultTitle: 'Passeport' },
  { id: 'identite', label: "Carte d'identité", defaultTitle: "Carte d'identité" },
  { id: 'permis', label: 'Permis', defaultTitle: 'Permis de conduire' },
  { id: 'vitale', label: 'Carte Vitale', defaultTitle: 'Carte Vitale' },
  { id: 'assurance', label: 'Assurance', defaultTitle: 'Assurance' },
  { id: 'carte_grise', label: 'Carte grise', defaultTitle: 'Carte grise' },
  { id: 'autre', label: 'Autre', defaultTitle: '' },
];

export const DOC_TYPE_LABEL: Record<DocType, string> = Object.fromEntries(DOC_TYPES.map((t) => [t.id, t.label])) as Record<
  DocType,
  string
>;

/** Seuils de rappel proposés (jours avant l'expiration). */
export const REMIND_OPTIONS: { label: string; days: number }[] = [
  { label: '6 mois avant', days: 180 },
  { label: '3 mois avant', days: 90 },
  { label: '1 mois avant', days: 30 },
  { label: '1 semaine avant', days: 7 },
  { label: 'Le jour J', days: 0 },
];

// ------------------------------------------------------------------ Dates

/** "2027-03-02" → Date locale (minuit). */
export function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const [y, m, j] = d.split('-').map(Number);
  return y ? new Date(y, m - 1, j) : null;
}

/** Date locale → "2027-03-02". */
export function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysLeft(doc: Pick<HouseDocument, 'expires_at'>): number | null {
  const exp = parseDate(doc.expires_at);
  if (!exp) return null;
  return Math.round((exp.getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
}

const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatLongDate = (d: Date) => longDate.format(d);
export const formatShortDate = (d: Date) => shortDate.format(d);

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

/** "bientôt" = dans la fenêtre du plus grand rappel choisi (6 mois par défaut). */
export function expiryStatus(doc: Pick<HouseDocument, 'expires_at' | 'remind_days'>): ExpiryStatus {
  const left = daysLeft(doc);
  if (left === null) return 'none';
  if (left < 0) return 'expired';
  const window = Math.max(30, ...doc.remind_days);
  return left <= window ? 'soon' : 'ok';
}

export const STATUS_DOT: Record<ExpiryStatus, string> = {
  expired: colors.danger,
  soon: colors.coral,
  ok: colors.lime,
  none: colors.mute,
};

/** "dans 4 mois", "dans 12 jours", "aujourd'hui", "expiré depuis 3 jours". */
export function relativeExpiry(left: number) {
  if (left === 0) return "aujourd'hui";
  const abs = Math.abs(left);
  const unit = abs >= 60 ? `${Math.round(abs / 30.4)} mois` : `${abs} jour${abs > 1 ? 's' : ''}`;
  return left > 0 ? `dans ${unit}` : `expiré depuis ${unit}`;
}

/** Libellé court pour les tuiles : "mars 2027", "expiré", "sans date". */
export function shortStatus(doc: Pick<HouseDocument, 'expires_at'>) {
  const exp = parseDate(doc.expires_at);
  if (!exp) return 'sans date';
  if (exp.getTime() < startOfDay(new Date()).getTime()) return 'expiré';
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(exp);
}

export function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.round(bytes / 1000)} Ko`;
}

// ------------------------------------------------------------------ Pages et PDF

export type DraftPage = { uri: string; width: number; height: number };
export type DraftPdf = { uri: string; name: string };
export type Draft = { kind: 'images'; pages: DraftPage[] } | { kind: 'pdf'; file: DraftPdf } | { kind: 'none' };

const MAX_SIDE = 1600;

/** Redimensionne + compresse une photo (≈300-500 Ko). */
export async function compressPhoto(p: DraftPage): Promise<DraftPage> {
  const scale = Math.min(1, MAX_SIDE / Math.max(p.width, p.height));
  const ctx = ImageManipulator.manipulate(p.uri);
  if (scale < 1) ctx.resize({ width: Math.round(p.width * scale), height: Math.round(p.height * scale) });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

async function makeThumb(p: DraftPage): Promise<Uint8Array> {
  const ctx = ImageManipulator.manipulate(p.uri);
  ctx.resize({ width: 360 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return new File(out.uri).bytes();
}

const A4_W = 595.28;
const A4_H = 841.89;

export type BuiltFile = { pdf: Uint8Array; thumb: Uint8Array | null; pageCount: number };

/** Photos → un seul PDF (une photo par page A4, centrée) ; PDF importé → gardé tel quel. */
export async function buildFile(draft: Draft): Promise<BuiltFile | null> {
  if (draft.kind === 'none') return null;
  if (draft.kind === 'pdf') {
    const bytes = await new File(draft.file.uri).bytes();
    let pageCount = 1;
    try {
      pageCount = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
    } catch {
      // PDF illisible par pdf-lib : on le garde quand même
    }
    return { pdf: bytes, thumb: null, pageCount };
  }

  const doc = await PDFDocument.create();
  doc.setTitle('MaCaz');
  for (const page of draft.pages) {
    const jpg = await doc.embedJpg(await new File(page.uri).bytes());
    const landscape = jpg.width > jpg.height;
    const [pw, ph] = landscape ? [A4_H, A4_W] : [A4_W, A4_H];
    const margin = 24;
    const scale = Math.min((pw - margin * 2) / jpg.width, (ph - margin * 2) / jpg.height);
    const w = jpg.width * scale;
    const h = jpg.height * scale;
    doc.addPage([pw, ph]).drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  const pdf = await doc.save();
  const thumb = draft.pages[0] ? await makeThumb(draft.pages[0]) : null;
  return { pdf, thumb, pageCount: draft.pages.length };
}

/** Copie temporaire (cache) d'un PDF téléchargé, pour l'ouvrir ou le partager. */
export function cacheFileFor(title: string) {
  const safe =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'papier';
  const file = new File(Paths.cache, `${safe}.pdf`);
  if (file.exists) file.delete();
  return file;
}

/** Corps binaire attendu par supabase-js (ArrayBuffer exact). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Papiers expirés ou bientôt expirés, du plus urgent au moins urgent. */
export function toRenew<T extends Pick<HouseDocument, 'expires_at' | 'remind_days'>>(documents: T[]) {
  return documents
    .filter((d) => {
      const s = expiryStatus(d);
      return s === 'soon' || s === 'expired';
    })
    .sort((a, b) => (a.expires_at ?? '').localeCompare(b.expires_at ?? ''));
}
