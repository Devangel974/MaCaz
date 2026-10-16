// Système visuel « pop tropicale » (planche « Système visuel » des maquettes).
import type { TextStyle, ViewStyle } from 'react-native';

import type { MemberColor } from '@/lib/database.types';

export const colors = {
  ground: '#F4F1FF', // lilas
  surface: '#FFFFFF',
  ink: '#1B1530',
  ink2: '#3C3652',
  ink3: '#5C5670', // ardoise : texte secondaire
  line: '#E6E1F7',
  lineSoft: '#ECE8F7',
  mute: '#C9C3E0', // brume : inactif
  navInactive: '#C9C3E0',

  accent: '#5B3DF5', // violet : actions, chat, « ensemble »
  accentPressed: '#4428D9',
  accentSoft: '#EDE8FF',
  accentGlow: 'rgba(91,61,245,0.32)',

  sun: '#FFC83D', // tournesol : courses
  sunDeep: '#FFB000',
  sunSoft: '#FFE39A',
  lagoon: '#12B5AE', // lagon : Julien, agenda
  coral: '#FF6B4A', // corail : Sarah, alertes
  coralSoft: '#FF8A6E',
  lime: '#7ED957', // citron vert : valide, en ligne

  warnBg: '#FF6B4A',
  warnFg: '#1B1530',
  okBg: '#E4F7DA',
  okFg: '#2F6B1F',
  danger: '#C2261A',
  online: '#7ED957',
  white: '#FFFFFF',
} as const;

/**
 * Couleur de chaque personne. Le texte posé dessus est toujours l'encre (contraste).
 * Les valeurs "blue"/"orange" de la base restent les identifiants internes.
 */
export const personColors: Record<MemberColor, { solid: string; soft: string; label: string }> = {
  blue: { solid: colors.lagoon, soft: '#D3F3F1', label: 'Lagon' },
  orange: { solid: colors.coral, soft: '#FFE1D9', label: 'Corail' },
};

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
} as const;

/** Titres en Bricolage Grotesque, texte en Plus Jakarta Sans. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, letterSpacing: -2.2 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  section: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

/** Grille 4/8 px. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { chip: 999, field: 18, tile: 24, card: 28, sheet: 36, pill: 999 } as const;

export const shadow = {
  card: {},
  soft: {},
  float: { boxShadow: '0 8px 24px rgba(91,61,245,0.14)' },
  nav: { boxShadow: '0 12px 32px rgba(27,21,48,0.28)' },
  primary: { boxShadow: `0 10px 24px ${colors.accentGlow}` },
} satisfies Record<string, ViewStyle>;

/** Hauteur minimale d'une cible tactile. */
export const HIT = 44;
