import {
  Car,
  CreditCard,
  FileText,
  HeartPulse,
  IdCard,
  type LucideIcon,
  Plane,
  ShieldCheck,
} from 'lucide-react-native';
import { View } from 'react-native';

import type { DocType, HouseDocument, Member } from '@/lib/database.types';
import { colors, personColors } from '@/theme';

export const DOC_ICON: Record<DocType, LucideIcon> = {
  passeport: Plane,
  identite: IdCard,
  permis: CreditCard,
  vitale: HeartPulse,
  assurance: ShieldCheck,
  carte_grise: Car,
  autre: FileText,
};

/** Lilas pour les papiers « de la caz ». */
export const CAZ_COLOR = '#B9A8FF';

export function ownerColor(owner: Pick<Member, 'color'> | null | undefined) {
  return owner ? personColors[owner.color].solid : CAZ_COLOR;
}

export function ownerName(doc: Pick<HouseDocument, 'owner_user'>, memberById: (id: string | null) => Member | null) {
  if (!doc.owner_user) return 'La caz';
  return memberById(doc.owner_user)?.display_name ?? '—';
}

export function DocIcon({ type, bg, size = 40 }: { type: DocType; bg: string; size?: number }) {
  const Icon = DOC_ICON[type] ?? FileText;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon size={size * 0.5} color={colors.ink} strokeWidth={2.2} />
    </View>
  );
}
