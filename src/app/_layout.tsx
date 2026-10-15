import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { HouseholdProvider, useHousehold } from '@/providers/HouseholdProvider';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold });

  return (
    <KeyboardProvider>
      <AuthProvider>
        <HouseholdProvider>
          <StatusBar style="dark" />
          {fontsLoaded && <RootNavigator />}
        </HouseholdProvider>
      </AuthProvider>
    </KeyboardProvider>
  );
}

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { household, loading: householdLoading } = useHousehold();
  const ready = !authLoading && (!session || !householdLoading);
  const inHousehold = !!session && !!household;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Appui sur une notification → ouvre l'écran concerné (ex. /chat).
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (inHousehold && typeof url === 'string' && (url === '/chat' || url === '/courses')) {
      router.navigate(url);
    }
  }, [response, inHousehold]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="connexion" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !household}>
        <Stack.Screen name="foyer-setup" />
      </Stack.Protected>
      <Stack.Protected guard={inHousehold}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="foyer" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
