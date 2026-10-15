import type { LucideIcon } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { AppText, EmptyState } from './ui';

/** Écran réservé aux modules des prochaines étapes (agenda, documents). */
export function ComingSoon({
  title,
  icon,
  headline,
  description,
  features,
}: {
  title: string;
  icon: LucideIcon;
  headline: string;
  description: string;
  features: string[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg }}>
      <AppText variant="title">{title}</AppText>
      <EmptyState icon={icon} title={headline} description={description} />
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.md }}>
        <AppText variant="overline" color={colors.ink3}>
          Au programme
        </AppText>
        {features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 8 }} />
            <AppText color={colors.ink2} style={{ flex: 1 }}>
              {f}
            </AppText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
