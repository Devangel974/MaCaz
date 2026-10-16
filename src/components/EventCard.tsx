import { MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { formatHour } from '@/lib/calendar';
import type { CalendarEvent, Member } from '@/lib/database.types';
import { colors, personColors, space } from '@/theme';

import { AppText } from './ui';

/** Couleur d'un événement : celle de la personne, ou violet pour « ensemble ». */
export function eventTone(e: Pick<CalendarEvent, 'for_user'>, memberById: (id: string | null) => Member | null) {
  const m = e.for_user ? memberById(e.for_user) : null;
  if (m) return { bg: personColors[m.color].solid, fg: colors.ink, who: m.display_name };
  return { bg: colors.accent, fg: colors.white, who: 'Ensemble' };
}

export function EventCard({
  event,
  memberById,
  onPress,
}: {
  event: CalendarEvent;
  memberById: (id: string | null) => Member | null;
  onPress: () => void;
}) {
  const tone = eventTone(event, memberById);
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const multiDay = end && end.toDateString() !== start.toDateString();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${event.all_day ? 'toute la journée' : formatHour(start)}, ${tone.who}${event.location ? `, ${event.location}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 14,
        paddingHorizontal: space.lg,
        borderRadius: 24,
        backgroundColor: tone.bg,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View style={{ width: 60 }}>
        {event.all_day ? (
          <AppText variant="label" color={tone.fg}>
            Journée
          </AppText>
        ) : (
          <>
            <AppText variant="section" color={tone.fg} style={{ fontVariant: ['tabular-nums'] }}>
              {formatHour(start)}
            </AppText>
            {end && !multiDay && (
              <AppText variant="caption" color={tone.fg}>
                {formatHour(end)}
              </AppText>
            )}
          </>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="bodyStrong" color={tone.fg} numberOfLines={2}>
          {event.title}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
          <AppText variant="caption" color={tone.fg}>
            {tone.who}
          </AppText>
          {!!event.location && (
            <>
              <MapPin size={12} color={tone.fg} strokeWidth={2.4} />
              <AppText variant="caption" color={tone.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
                {event.location}
              </AppText>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}
