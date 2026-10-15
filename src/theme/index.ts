// Système visuel validé (planche « Système visuel » des maquettes).
import type { TextStyle, ViewStyle } from 'react-native';

import type { MemberColor } from '@/lib/database.types';

export const colors = {
  ground: '#F3F4F1',
  surface: '#FFFFFF',
  ink: '#16201E',
  ink2: '#3F4A48',
  ink3: '#5E6866',
  line: '#E6E8E4',
  lineSoft: '#EEF0EC',
  mute: '#A9B0AD',

  accent: '#1F6B57',
  accentPressed: '#16503F',
  accentSoft: '#1F6B571F',
  accentGlow: '#1F6B5740',

  warnBg: '#FCEFD9',
  warnFg: '#7A4A00',
  warnIcon: '#8A5200',
  okBg: '#E4F1E7',
  okFg: '#2F6B3F',
  danger: '#B3261E',
  online: '#2F8A4F',
  white: '#FFFFFF',
} as const;

/** Couleur de chaque personne (bleu / orange), toujours doublée d'un libellé. */
export const personColors: Record<MemberColor, { solid: string; soft: string }> = {
  blue: { solid: '#2A62A8', soft: '#E5EDF8' },
  orange: { solid: '#B8512A', soft: '#FAE8DF' },
};

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  semibold: 'PlusJakartaSans_600SemiBold',
} as const;

/** 4 tailles max, 2 graisses. */
export const type = {
  title: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
  section: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.52,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

/** Grille 4/8 px. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { chip: 10, field: 16, card: 20, pill: 999 } as const;

export const shadow = {
  card: { boxShadow: '0 1px 2px rgba(22,32,30,0.05), 0 8px 24px rgba(22,32,30,0.05)' },
  soft: { boxShadow: '0 1px 2px rgba(22,32,30,0.06)' },
  primary: {
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 24px ${colors.accentGlow}`,
  },
} satisfies Record<string, ViewStyle>;

/** Hauteur minimale d'une cible tactile. */
export const HIT = 44;
