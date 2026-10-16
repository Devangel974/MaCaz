import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, HIT, radius, shadow, space, type } from '@/theme';

// ---------------------------------------------------------------- Texte

type Variant = keyof typeof type;

export function AppText({
  variant = 'body',
  color = colors.ink,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[type[variant], { color }, style]} />;
}

// ---------------------------------------------------------------- Boutons

export function PrimaryButton({
  label,
  icon: Icon,
  loading,
  disabled,
  tone = 'accent',
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: LucideIcon;
  loading?: boolean;
  /** "accent" = violet ; "ink" = encre (bouton de validation). */
  tone?: 'accent' | 'ink';
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const bg = tone === 'ink' ? colors.ink : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          paddingHorizontal: space.xl,
          opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        !isDisabled && tone === 'accent' && shadow.primary,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <AppText variant="bodyStrong" color={colors.white}>
            {label}
          </AppText>
          {Icon && <Icon size={20} color={colors.white} strokeWidth={2.4} />}
        </>
      )}
    </Pressable>
  );
}

/** Bouton secondaire plein, couleur vive au choix (texte encre). */
export function SecondaryButton({
  label,
  bg = colors.sun,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const light = bg === colors.accent || bg === colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.lg,
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
      {...rest}>
      <AppText variant="label" color={light ? colors.white : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'raised',
  size = HIT,
  color = colors.ink,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  icon: LucideIcon;
  label: string;
  variant?: 'raised' | 'plain' | 'primary' | 'tint';
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'raised'
        ? colors.surface
        : variant === 'tint'
          ? colors.ground
          : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={size < HIT ? (HIT - size) / 2 : 0}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          opacity: rest.disabled ? 0.5 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
      {...rest}>
      <Icon
        size={22}
        color={variant === 'primary' ? colors.white : color}
        strokeWidth={variant === 'primary' ? 2.6 : 2.2}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Surfaces

/** Carte arrondie ; `bg` permet les blocs colorés (tournesol, violet, lagon…). */
export function Card({
  children,
  onPress,
  bg = colors.surface,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.card,
    padding: space.lg,
    overflow: 'hidden',
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  bg = colors.surface,
  color = colors.ink,
  style,
}: {
  label: string;
  bg?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.chip, backgroundColor: bg },
        style,
      ]}>
      <AppText variant="label" color={color}>
        {label}
      </AppText>
    </View>
  );
}

/** Barre de progression en segments (un segment par article, jusqu'à 16). */
export function SegmentBar({
  done,
  total,
  color = colors.ink,
  track = colors.surface,
}: {
  done: number;
  total: number;
  color?: string;
  track?: string;
}) {
  const n = Math.min(total, 16);
  const filled = total === 0 ? 0 : Math.round((done / total) * n);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} sur ${total}`}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={{ flexDirection: 'row', gap: space.xs }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < filled ? color : track }} />
      ))}
    </View>
  );
}

/** Titre de section avec pastille colorée. */
export function SectionTitle({
  children,
  dot,
  count,
  style,
}: {
  children: ReactNode;
  dot?: string;
  count?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style as StyleProp<ViewStyle>]}>
      {dot && <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: dot }} />}
      <AppText variant="overline">{children}</AppText>
      {count !== undefined && (
        <AppText variant="caption" color={colors.ink3}>
          {count}
        </AppText>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Champs

export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.ink3}
        style={[
          type.body,
          {
            height: 54,
            paddingHorizontal: 18,
            borderRadius: radius.field,
            backgroundColor: colors.ground,
            color: colors.ink,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

// ---------------------------------------------------------------- États

export function EmptyState({
  icon: Icon,
  title,
  description,
  tint = colors.sun,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tint?: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingVertical: space.xxxl }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 26,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.sm,
          transform: [{ rotate: '-8deg' }],
        }}>
        <Icon size={32} color={tint === colors.accent ? colors.white : colors.ink} strokeWidth={2.2} />
      </View>
      <AppText variant="section" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText color={colors.ink3} style={{ textAlign: 'center' }}>
        {description}
      </AppText>
      {action}
    </View>
  );
}
