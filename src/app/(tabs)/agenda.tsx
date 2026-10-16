import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard, eventTone } from '@/components/EventCard';
import { AppText, Chip, EmptyState, IconButton } from '@/components/ui';
import {
  addDays,
  daySectionTitle,
  dayKey,
  dowShort,
  monthTitle,
  occursOn,
  parseDayKey,
  sameDay,
  startOfDay,
  startOfWeek,
} from '@/lib/calendar';
import type { CalendarEvent } from '@/lib/database.types';
import { useEvents } from '@/providers/EventsProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, shadow, space } from '@/theme';

type Filter = 'all' | 'me' | 'partner' | 'both';
const LIST_DAYS = 14;

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const { events, loading } = useEvents();
  const { me, partner, memberById } = useHousehold();
  const [filter, setFilter] = useState<Filter>('all');

  // Jour choisi : celui du lien (notification, carte du chat), sinon aujourd'hui ;
  // un choix manuel l'emporte tant que le lien ne change pas.
  const today = startOfDay(new Date());
  const param = typeof params.date === 'string' ? params.date : undefined;
  const [pick, setPick] = useState<{ key: string; under?: string } | null>(null);
  const selectedKey = pick && pick.under === param ? pick.key : (param ?? dayKey(today));
  const selected = parseDayKey(selectedKey) ?? today;
  const select = (d: Date) => setPick({ key: dayKey(d), under: param });

  const weekStart = startOfWeek(selected);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // (Le React Compiler mémoïse ces calculs.)
  const visible = events.filter((e) => {
    if (filter === 'me') return e.for_user === me?.user_id;
    if (filter === 'partner') return e.for_user === partner?.user_id;
    if (filter === 'both') return e.for_user === null;
    return true;
  });

  const sections: { day: Date; events: CalendarEvent[] }[] = [];
  for (let i = 0; i < LIST_DAYS; i++) {
    const day = addDays(selected, i);
    const list = visible.filter((e) => occursOn(e, day));
    if (list.length || i === 0) sections.push({ day, events: list });
  }

  const dotsFor = (day: Date) =>
    events
      .filter((e) => occursOn(e, day))
      .slice(0, 3)
      .map((e) => eventTone(e, memberById).bg);

  const filters: { id: Filter; label: string; bg: string; fg: string }[] = [
    { id: 'all', label: 'Tous', bg: colors.ink, fg: colors.white },
    ...(me ? [{ id: 'me' as const, label: me.display_name, bg: personColors[me.color].solid, fg: colors.ink }] : []),
    ...(partner
      ? [{ id: 'partner' as const, label: partner.display_name, bg: personColors[partner.color].solid, fg: colors.ink }]
      : []),
    { id: 'both', label: 'Ensemble', bg: colors.accent, fg: colors.white },
  ];

  const openNew = () => router.push({ pathname: '/evenement', params: { date: dayKey(selected) } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ gap: space.lg, paddingTop: insets.top + space.xl, paddingHorizontal: space.lg, paddingBottom: space.md }}>
        {/* Mois + navigation par semaine */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText variant="title" style={{ flex: 1 }}>
            {monthTitle(addDays(weekStart, 3))}
          </AppText>
          {!week.some((d) => sameDay(d, today)) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => select(today)}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}>
              <Chip label="Aujourd'hui" bg={colors.sun} />
            </Pressable>
          )}
          <IconButton icon={ChevronLeft} label="Semaine précédente" onPress={() => select(addDays(selected, -7))} />
          <IconButton icon={ChevronRight} label="Semaine suivante" onPress={() => select(addDays(selected, 7))} />
        </View>

        {/* Bandeau des 7 jours */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {week.map((d) => {
            const isSel = sameDay(d, selected);
            const isToday = sameDay(d, today);
            const dots = dotsFor(d);
            return (
              <Pressable
                key={dayKey(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${daySectionTitle(d)}${dots.length ? `, ${dots.length} événement${dots.length > 1 ? 's' : ''}` : ''}`}
                onPress={() => select(d)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 80,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space.xs,
                  backgroundColor: isSel ? colors.accent : colors.surface,
                  borderWidth: isToday && !isSel ? 2 : 0,
                  borderColor: colors.accent,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}>
                <AppText variant="label" color={isSel ? colors.white : colors.ink}>
                  {dowShort(d)}
                </AppText>
                <AppText variant="section" color={isSel ? colors.white : colors.ink}>
                  {d.getDate()}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                  {dots.map((c, i) => (
                    <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isSel ? colors.sun : c }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Filtres par personne */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f.id)}
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  justifyContent: 'center',
                  backgroundColor: active ? f.bg : colors.surface,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <AppText variant="label" color={active ? f.fg : colors.ink}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96, gap: 20 }}>
        {!loading && events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            tint={colors.lagoon}
            title="Rien de prévu pour l'instant"
            description="Ajoute un premier événement : ta moitié le verra aussitôt, avec un petit mot dans le chat."
          />
        ) : (
          sections.map(({ day, events: list }) => (
            <View key={dayKey(day)} style={{ gap: space.sm }}>
              <AppText variant="overline" style={{ paddingHorizontal: space.xs }}>
                {daySectionTitle(day)}
              </AppText>
              {list.length === 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={openNew}
                  style={({ pressed }) => ({
                    padding: space.lg,
                    borderRadius: 24,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: colors.mute,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}>
                  <AppText color={colors.ink3}>Rien ce jour-là. Toucher pour ajouter un événement.</AppText>
                </Pressable>
              ) : (
                list.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    memberById={memberById}
                    onPress={() => router.push({ pathname: '/evenement', params: { id: e.id } })}
                  />
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouvel événement"
        onPress={openNew}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: space.lg,
            bottom: space.lg,
            height: 56,
            paddingLeft: space.lg,
            paddingRight: 20,
            borderRadius: 28,
            backgroundColor: colors.sun,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
          shadow.float,
        ]}>
        <Plus size={22} color={colors.ink} strokeWidth={2.6} />
        <AppText variant="bodyStrong">Événement</AppText>
      </Pressable>
    </View>
  );
}
