import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { dayKey } from '@/lib/calendar';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { ChatProvider } from '@/providers/ChatProvider';
import { DocumentsProvider } from '@/providers/DocumentsProvider';
import { EventsProvider } from '@/providers/EventsProvider';
import { HouseholdProvider, useHousehold } from '@/providers/HouseholdProvider';
import { ShoppingProvider } from '@/providers/ShoppingProvider';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    BricolageGrotesque_800ExtraBold,
  });

  return (
    <KeyboardProvider>
      <AuthProvider>
        <HouseholdProvider>
          <StatusBar style="dark" />
          <DataProviders>{fontsLoaded && <RootNavigator />}</DataProviders>
        </HouseholdProvider>
      </AuthProvider>
    </KeyboardProvider>
  );
}

/**
 * Données du foyer partagées par les onglets et les modales (ex. formulaire d'événement).
 * Remontées à chaque changement de foyer pour ne jamais mélanger deux comptes.
 */
function DataProviders({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  return (
    <ShoppingProvider key={household?.id ?? 'aucun'}>
      <ChatProvider>
        <EventsProvider>
          <DocumentsProvider>{children}</DocumentsProvider>
        </EventsProvider>
      </ChatProvider>
    </ShoppingProvider>
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
    if (!inHousehold || typeof url !== 'string') return;
    if (url === '/chat' || url === '/courses' || url === '/documents') router.navigate(url);
    if (url === '/papier') {
      const id = response?.notification.request.content.data?.id;
      if (typeof id === 'string') router.navigate({ pathname: '/papier', params: { id } });
      else router.navigate('/documents');
    }
    if (url === '/agenda') {
      const day = response?.notification.request.content.data?.day;
      router.navigate({ pathname: '/agenda', params: typeof day === 'string' ? { date: dayKey(new Date(day)) } : {} });
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
        <Stack.Screen name="reglages" options={{ presentation: 'modal' }} />
        <Stack.Screen name="evenement" options={{ presentation: 'modal' }} />
        <Stack.Screen name="papier" />
        <Stack.Screen name="papier-edition" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
