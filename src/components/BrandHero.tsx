import { House } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { AppText } from './ui';

/**
 * Écrans d'accueil (connexion, création du foyer) : grand bloc violet avec formes
 * colorées, puis une feuille blanche arrondie qui porte le formulaire.
 */
export function BrandHero({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      bottomOffset={space.xl}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.accent }}
      contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ paddingTop: insets.top + 56, paddingHorizontal: space.xl, paddingBottom: space.xxl, minHeight: 320 }}>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: -40, top: insets.top + 24, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.sun }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 96,
            top: insets.top + 160,
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: colors.coral,
            transform: [{ rotate: '18deg' }],
          }}
        />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: 24, top: insets.top + 220, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lagoon }}
        />
        <View style={{ gap: space.lg, maxWidth: 230 }}>
          <View
            accessibilityLabel="Logo MaCaz"
            style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <House size={34} color={colors.accent} strokeWidth={2.2} />
          </View>
          <AppText variant="hero" color={colors.white}>
            {title}
          </AppText>
          <AppText color={colors.white}>{subtitle}</AppText>
        </View>
      </View>
      <View
        style={{
          flex: 1,
          gap: space.lg,
          paddingTop: space.xxl,
          paddingHorizontal: space.xl,
          paddingBottom: insets.bottom + space.xxl,
          borderTopLeftRadius: radius.sheet,
          borderTopRightRadius: radius.sheet,
          backgroundColor: colors.surface,
        }}>
        {children}
      </View>
    </KeyboardAwareScrollView>
  );
}
