import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { colors } from '@/theme';

/** Vrai quand l'écran Chat est affiché : on n'affiche pas de bannière pour un message qu'on lit déjà. */
let chatVisible = false;
export function setChatVisible(visible: boolean) {
  chatVisible = visible;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const url = notification.request.content.data?.url;
    const hide = chatVisible && url === '/chat';
    return {
      shouldShowBanner: !hide,
      shouldShowList: !hide,
      shouldPlaySound: !hide,
      shouldSetBadge: false,
    };
  },
});

export const MESSAGES_CHANNEL = 'messages';

/**
 * Demande la permission et renvoie le jeton Expo Push, ou null si indisponible
 * (émulateur, Expo Go, permission refusée, projectId EAS absent).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
      name: 'Messages du foyer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: colors.accent,
    });
  }

  // Depuis le SDK 53, le push distant n'est plus disponible dans Expo Go sur Android.
  if (!Device.isDevice || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return null;
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] projectId EAS introuvable : lance `npx eas-cli@latest init`.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('[push] jeton indisponible', e);
    return null;
  }
}
