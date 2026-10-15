import { View } from 'react-native';

import type { Member } from '@/lib/database.types';
import { colors, personColors } from '@/theme';

import { AppText } from './ui';

type Props = {
  member: Pick<Member, 'display_name' | 'color'> | null | undefined;
  size?: number;
  /** "solid" = pastille pleine (en-têtes) ; "soft" = discrète (lignes de liste). */
  tone?: 'solid' | 'soft';
  /** Liseré de la couleur du fond, pour superposer deux avatars. */
  ring?: string;
};

export function Avatar({ member, size = 32, tone = 'solid', ring }: Props) {
  const palette = member ? personColors[member.color] : { solid: colors.mute, soft: colors.lineSoft };
  const initial = member?.display_name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      accessibilityLabel={member?.display_name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone === 'solid' ? palette.solid : palette.soft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}>
      <AppText
        variant={size >= 40 ? 'bodyStrong' : 'label'}
        color={tone === 'solid' ? colors.white : palette.solid}
        style={size < 28 ? { fontSize: 12, lineHeight: 16 } : undefined}>
        {initial}
      </AppText>
    </View>
  );
}

/** Deux avatars superposés : le foyer. */
export function AvatarPair({
  members,
  size = 32,
  ring = colors.ground,
}: {
  members: Pick<Member, 'display_name' | 'color'>[];
  size?: number;
  ring?: string;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {members.slice(0, 2).map((m, i) => (
        <View key={m.display_name + i} style={{ marginLeft: i === 0 ? 0 : -size / 4 }}>
          <Avatar member={m} size={size} ring={ring} />
        </View>
      ))}
    </View>
  );
}
