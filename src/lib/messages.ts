import type { Message } from './database.types';

/** Noms d'articles portés par une carte "items_added". */
export function itemsOf(m: Pick<Message, 'meta'>): string[] {
  const meta = m.meta;
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && Array.isArray(meta.items)) {
    return meta.items.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

/** Aperçu d'une ligne pour l'accueil. */
export function preview(m: Pick<Message, 'kind' | 'body' | 'meta'>) {
  if (m.kind === 'items_added') {
    const items = itemsOf(m);
    return `a ajouté ${items.length > 1 ? `${items.length} articles` : (items[0] ?? 'un article')} à la liste`;
  }
  return m.body;
}
