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

import { colors, space } from '@/theme';

import { AppText } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Accueil', icon: House },
  courses: { label: 'Courses', icon: ShoppingBag },
  chat: { label: 'Chat', icon: MessageSquare },
  agenda: { label: 'Agenda', icon: CalendarDays },
  documents: { label: 'Documents', icon: FileText },
};

/** Barre d'onglets Material 3 (pilule sur l'onglet actif), conforme aux maquettes. */
export function TabBar({ state, descriptors, navigation, insets, badges }: TabBarProps & { badges?: Record<string, boolean> }) {
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: space.sm,
        paddingBottom: Math.max(insets.bottom, space.lg),
        paddingHorizontal: space.xs,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}>
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
            style={{ alignItems: 'center', gap: space.xs, width: 76, paddingTop: space.xs }}>
            <View
              style={{
                width: 56,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.accentSoft : 'transparent',
              }}>
              <Icon size={22} strokeWidth={1.8} color={focused ? colors.accent : colors.ink3} />
              {badges?.[route.name] && (
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 12,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#B8512A',
                  }}
                />
              )}
            </View>
            <AppText variant={focused ? 'label' : 'caption'} color={focused ? colors.ink : colors.ink3}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
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
