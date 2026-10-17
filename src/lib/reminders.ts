import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { colors } from '@/theme';

import { formatEventWhen, reminderDate } from './calendar';
import type { CalendarEvent } from './database.types';

const PREFIX = 'event-';
const HORIZON_MS = 60 * 86_400_000; // on programme 60 jours à l'avance
const CHANNEL = 'rappels';

let channelReady = false;
async function ensureChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Rappels de l'agenda",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.accent,
  });
  channelReady = true;
}

let running: Promise<void> | null = null;

/**
 * Reprogramme les rappels locaux de ce téléphone : uniquement les événements
 * qui me concernent (pour moi ou « ensemble »). Idempotent : on efface puis on recrée.
 */
export function syncReminders(events: CalendarEvent[], myId: string | undefined) {
  if (Platform.OS === 'web' || !myId) return Promise.resolve();
  // Sérialise les appels (plusieurs mises à jour temps réel rapprochées).
  const next = (running ?? Promise.resolve()).then(() => doSync(events, myId)).catch((e) => {
    console.warn('[rappels]', e);
  });
  running = next;
  return next;
}

async function doSync(events: CalendarEvent[], myId: string) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await ensureChannel();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  for (const e of events) {
    if (e.for_user && e.for_user !== myId) continue;
    const at = reminderDate(e);
    if (!at || at.getTime() <= now || at.getTime() > now + HORIZON_MS) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${e.id}`,
      content: {
        title: e.title,
        body: [formatEventWhen(e.starts_at, e.all_day), e.location].filter(Boolean).join(' · '),
        data: { url: '/agenda', day: e.starts_at },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

// ------------------------------------------------------------------ Papiers

const DOC_PREFIX = 'doc-';
let docsRunning: Promise<void> | null = null;

/**
 * Rappels d'expiration des papiers, sur les deux téléphones : à 9 h, aux seuils
 * choisis (6 mois, 1 mois, jour J…). Idempotent, comme pour l'agenda.
 */
export function syncDocumentReminders(
  docs: { id: string; title: string; expires_at: string | null; remind_days: number[] }[],
) {
  if (Platform.OS === 'web') return Promise.resolve();
  const next = (docsRunning ?? Promise.resolve()).then(() => doSyncDocs(docs)).catch((e) => {
    console.warn('[rappels papiers]', e);
  });
  docsRunning = next;
  return next;
}

async function doSyncDocs(docs: { id: string; title: string; expires_at: string | null; remind_days: number[] }[]) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await ensureChannel();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(DOC_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  const longFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  for (const d of docs) {
    if (!d.expires_at) continue;
    const [y, m, j] = d.expires_at.split('-').map(Number);
    for (const days of d.remind_days) {
      const at = new Date(y, m - 1, j - days, 9, 0);
      if (at.getTime() <= now || at.getTime() > now + 400 * 86_400_000) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${DOC_PREFIX}${d.id}-${days}`,
        content: {
          title: days === 0 ? `${d.title} expire aujourd'hui` : `${d.title} : pense au renouvellement`,
          body: `Date d'expiration : ${longFmt.format(new Date(y, m - 1, j))}`,
          data: { url: '/papier', id: d.id },
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  }
}
