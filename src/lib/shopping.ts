// Catégorisation automatique des articles + extraction de la quantité.

export type CategoryId =
  | 'fruits-legumes'
  | 'boucherie'
  | 'cremerie'
  | 'boulangerie'
  | 'epicerie'
  | 'surgeles'
  | 'boissons'
  | 'hygiene'
  | 'maison'
  | 'autre';

/** Ordre d'affichage = ordre de passage typique en magasin. */
export const CATEGORIES: { id: CategoryId; label: string; keywords: string[] }[] = [
  {
    id: 'fruits-legumes',
    label: 'Fruits & légumes',
    keywords: [
      'tomate', 'oignon', 'ail', 'gingembre', 'piment', 'carotte', 'pomme de terre', 'patate', 'salade', 'laitue',
      'concombre', 'courgette', 'aubergine', 'poivron', 'chou', 'brede', 'chouchou', 'citrouille', 'giraumon',
      'banane', 'pomme', 'poire', 'orange', 'citron', 'mangue', 'letchi', 'litchi', 'ananas', 'papaye', 'fraise',
      'raisin', 'avocat', 'herbe', 'persil', 'coriandre', 'thym', 'cebette', 'echalote', 'fruit', 'legume',
      'champignon', 'haricot vert', 'epinard', 'brocoli', 'melon', 'pasteque', 'kiwi', 'goyave', 'fruit de la passion',
    ],
  },
  {
    id: 'boucherie',
    label: 'Boucherie & poisson',
    keywords: [
      'saucisse', 'poulet', 'boeuf', 'bœuf', 'porc', 'agneau', 'cabri', 'viande', 'steak', 'jambon', 'lardon',
      'boucane', 'poisson', 'thon', 'saumon', 'crevette', 'morue', 'canard', 'dinde', 'escalope', 'merguez', 'rougail',
    ],
  },
  {
    id: 'cremerie',
    label: 'Crèmerie',
    keywords: ['lait', 'beurre', 'creme', 'fromage', 'yaourt', 'yogourt', 'oeuf', 'œuf', 'emmental', 'mozzarella', 'skyr'],
  },
  {
    id: 'boulangerie',
    label: 'Boulangerie',
    keywords: ['pain', 'baguette', 'croissant', 'brioche', 'viennoiserie', 'gateau', 'biscotte', 'pain de mie'],
  },
  {
    id: 'epicerie',
    label: 'Épicerie',
    keywords: [
      'riz', 'pate', 'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'curcuma', 'safran', 'epice', 'massale',
      'cafe', 'the', 'chocolat', 'confiture', 'cereale', 'conserve', 'sauce', 'ketchup', 'moutarde', 'mayonnaise',
      'lentille', 'grain', 'pois', 'haricot', 'biscuit', 'chips', 'miel', 'levure', 'cube', 'bouillon', 'vanille',
    ],
  },
  { id: 'surgeles', label: 'Surgelés', keywords: ['surgele', 'glace', 'pizza', 'frite', 'glacon'] },
  {
    id: 'boissons',
    label: 'Boissons',
    keywords: ['eau', 'jus', 'soda', 'coca', 'biere', 'vin', 'rhum', 'sirop', 'limonade', 'cidre'],
  },
  {
    id: 'hygiene',
    label: 'Hygiène & beauté',
    keywords: [
      'dentifrice', 'brosse a dent', 'shampoing', 'shampooing', 'savon', 'gel douche', 'deodorant', 'coton',
      'rasoir', 'creme solaire', 'serviette hygienique', 'tampon', 'mouchoir',
    ],
  },
  {
    id: 'maison',
    label: 'Maison',
    keywords: [
      'lessive', 'liquide vaisselle', 'eponge', 'papier toilette', 'sopalin', 'essuie-tout', 'sac poubelle',
      'javel', 'nettoyant', 'ampoule', 'pile', 'aluminium', 'film', 'anti-moustique', 'insecticide', 'adoucissant',
    ],
  },
  { id: 'autre', label: 'Autres', keywords: [] },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .trim();
}

export function categorize(name: string): CategoryId {
  const n = ` ${normalize(name)} `;
  let best: { id: CategoryId; len: number } | null = null;
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      const k = normalize(kw);
      // mot entier, pluriel en "s" / "x" toléré
      const re = new RegExp(`[\\s'-]${escapeRe(k)}(s|x)?[\\s,.-]`);
      if (re.test(n) && (!best || k.length > best.len)) best = { id: cat.id, len: k.length };
    }
  }
  return best?.id ?? 'autre';
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const UNIT = '(?:kg|g|gr|l|cl|ml|x|lot|lots|paquets?|boites?|bouteilles?|barquettes?|sachets?|pots?|tranches?)';
const LEADING = new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${UNIT}?)\\s+(?:de\\s+|d')?(.+)$`, 'i');
const TRAILING = new RegExp(`^(.+?)\\s+(x?\\d+(?:[.,]\\d+)?\\s*${UNIT}?)$`, 'i');

/** "2 kg tomates" / "tomates 2kg" / "Pain x2" → { name: "Tomates", quantity: "2 kg" } */
export function parseItem(input: string): { name: string; quantity: string | null } {
  const raw = input.replace(/\s+/g, ' ').trim();
  let name = raw;
  let quantity: string | null = null;
  const lead = raw.match(LEADING);
  const trail = raw.match(TRAILING);
  if (lead) {
    quantity = lead[1];
    name = lead[2];
  } else if (trail) {
    name = trail[1];
    quantity = trail[2];
  }
  if (quantity) {
    quantity = quantity
      .replace(/^x(\d)/i, '$1')
      .replace(/(\d)\s*([a-z])/i, '$1 $2')
      .trim();
  }
  return { name: name.charAt(0).toUpperCase() + name.slice(1), quantity };
}
