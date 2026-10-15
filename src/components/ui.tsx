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
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  icon?: LucideIcon;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          paddingHorizontal: space.xl,
          opacity: isDisabled ? 0.6 : 1,
        },
        !isDisabled && shadow.primary,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          {Icon && <Icon size={22} color={colors.white} strokeWidth={1.8} />}
          <AppText variant="bodyStrong" color={colors.white}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  selected = true,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: 48,
          borderRadius: radius.field,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.lg,
          backgroundColor: selected ? colors.accentSoft : colors.surface,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.line,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
      {...rest}>
      <AppText variant="label" color={selected ? colors.accent : colors.ink}>
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
  variant?: 'raised' | 'plain' | 'primary';
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary' ? colors.accent : variant === 'raised' ? colors.surface : 'transparent';
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
          opacity: pressed ? 0.75 : rest.disabled ? 0.5 : 1,
        },
        variant === 'raised' && shadow.card,
        variant === 'primary' && shadow.primary,
        style,
      ]}
      {...rest}>
      <Icon
        size={22}
        color={variant === 'primary' ? colors.white : color}
        strokeWidth={variant === 'primary' ? 2.2 : 1.8}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Surfaces

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.lg,
  };
  if (!onPress) return <View style={[base, shadow.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, shadow.card, { opacity: pressed ? 0.85 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Chip({ label, muted, style }: { label: string; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: space.md, backgroundColor: colors.ground },
        style,
      ]}>
      <AppText variant="caption" color={muted ? colors.ink3 : colors.ink}>
        {label}
      </AppText>
    </View>
  );
}

export function ProgressBar({ value, color = colors.accent, track = colors.lineSoft }: { value: number; color?: string; track?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <AppText variant="overline" color={colors.ink3} style={[{ paddingHorizontal: space.xs }, style]}>
      {children}
    </AppText>
  );
}

// ---------------------------------------------------------------- Champs

export function Field({
  label,
  style,
  ...rest
}: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label" color={colors.ink2}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.ink3}
        style={[
          type.body,
          {
            height: 52,
            paddingHorizontal: space.lg,
            borderWidth: 1,
            borderColor: '#D9DDD8',
            borderRadius: radius.field,
            backgroundColor: colors.surface,
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
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingVertical: space.xxxl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.sm,
        }}>
        <Icon size={28} color={colors.accent} strokeWidth={1.8} />
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
