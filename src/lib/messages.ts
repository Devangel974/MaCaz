import { formatEventWhen } from './calendar';
import type { Message } from './database.types';

type Meta = Record<string, unknown>;

function metaOf(m: Pick<Message, 'meta'>): Meta {
  const meta = m.meta;
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Meta) : {};
}

/** Noms d'articles portés par une carte "items_added". */
export function itemsOf(m: Pick<Message, 'meta'>): string[] {
  const items = metaOf(m).items;
  return Array.isArray(items) ? items.filter((x): x is string => typeof x === 'string') : [];
}

export type EventMeta = { eventId: string; title: string; startsAt: string; allDay: boolean; forUser: string | null };

/** Événement porté par une carte "event_added". */
export function eventOf(m: Pick<Message, 'meta'>): EventMeta | null {
  const meta = metaOf(m);
  if (typeof meta.event_id !== 'string' || typeof meta.starts_at !== 'string') return null;
  return {
    eventId: meta.event_id,
    title: typeof meta.title === 'string' ? meta.title : 'Événement',
    startsAt: meta.starts_at,
    allDay: meta.all_day === true,
    forUser: typeof meta.for_user === 'string' ? meta.for_user : null,
  };
}

export type DocMeta = {
  documentId: string;
  title: string;
  ownerUser: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
};

/** Papier porté par une carte "document_added" / "document_expiring". */
export function documentOf(m: Pick<Message, 'meta'>): DocMeta | null {
  const meta = metaOf(m);
  if (typeof meta.document_id !== 'string') return null;
  return {
    documentId: meta.document_id,
    title: typeof meta.title === 'string' ? meta.title : 'Papier',
    ownerUser: typeof meta.owner_user === 'string' ? meta.owner_user : null,
    expiresAt: typeof meta.expires_at === 'string' ? meta.expires_at : null,
    daysLeft: typeof meta.days_left === 'number' ? meta.days_left : null,
  };
}

/** "expire dans 30 jours", "expire aujourd'hui", "a expiré". */
export function expiringText(daysLeft: number | null) {
  if (daysLeft === null) return 'arrive à expiration';
  if (daysLeft < 0) return 'a expiré';
  if (daysLeft === 0) return "expire aujourd'hui";
  if (daysLeft >= 60) return `expire dans ${Math.round(daysLeft / 30.4)} mois`;
  return `expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
}

/** Aperçu d'une ligne pour l'accueil. */
export function preview(m: Pick<Message, 'kind' | 'body' | 'meta'>) {
  if (m.kind === 'items_added') {
    const items = itemsOf(m);
    return `a ajouté ${items.length > 1 ? `${items.length} articles` : (items[0] ?? 'un article')} à la liste`;
  }
  if (m.kind === 'event_added') {
    const e = eventOf(m);
    return e ? `a ajouté « ${e.title} », ${formatEventWhen(e.startsAt, e.allDay)}` : 'a ajouté un événement';
  }
  if (m.kind === 'document_added') {
    return `a ajouté un papier : ${documentOf(m)?.title ?? 'papier'}`;
  }
  if (m.kind === 'document_expiring') {
    const d = documentOf(m);
    return `${d?.title ?? 'Un papier'} ${expiringText(d?.daysLeft ?? null)}`;
  }
  return m.body;
}
