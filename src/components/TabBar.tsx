import type { Tabs } from 'expo-router';
import {
  CalendarDays,
  FileText,
  House,
  type LucideIcon,
  MessageSquare,
  ShoppingBag,
} from 'lucide-react-native';
import { type ComponentProps, useEffect, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';

import { colors, shadow, space } from '@/theme';

import { AppText } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Accueil', icon: House },
  courses: { label: 'Courses', icon: ShoppingBag },
  chat: { label: 'Chat', icon: MessageSquare },
  agenda: { label: 'Agenda', icon: CalendarDays },
  documents: { label: 'Documents', icon: FileText },
};

/** Barre d'onglets flottante : pilule encre, onglet actif en pilule violette avec son nom. */
export function TabBar({ state, descriptors, navigation, insets, badges }: TabBarProps & { badges?: Record<string, boolean> }) {
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;

  return (
    <View
      style={{
        backgroundColor: colors.ground,
        paddingHorizontal: space.md,
        paddingTop: space.xs,
        paddingBottom: Math.max(insets.bottom, space.md) + space.xs,
      }}>
      <View
        accessibilityRole="tablist"
        style={[
          {
            flexDirection: 'row',
            justifyContent: 'space-between',
            padding: space.sm,
            borderRadius: 32,
            backgroundColor: colors.ink,
          },
          shadow.nav,
        ]}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const Icon = tab.icon;
          const { options } = descriptors[route.key];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? tab.label}
              onPress={onPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 48,
                minWidth: 48,
                paddingHorizontal: focused ? space.lg : 0,
                borderRadius: 24,
                backgroundColor: focused ? colors.accent : 'transparent',
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}>
              <View>
                <Icon size={22} strokeWidth={2} color={focused ? colors.white : colors.navInactive} />
                {badges?.[route.name] && !focused && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -4,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.sun,
                      borderWidth: 2,
                      borderColor: colors.ink,
                    }}
                  />
                )}
              </View>
              {focused && (
                <AppText variant="label" color={colors.white}>
                  {tab.label}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}
