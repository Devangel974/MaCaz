import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniCalendar } from '@/components/MiniCalendar';
import { AppText, Field, IconButton, PrimaryButton } from '@/components/ui';
import {
  addDays,
  DAY_MS,
  DURATION_OPTIONS,
  parseDayKey,
  REMINDER_OPTIONS_ALL_DAY,
  REMINDER_OPTIONS_TIMED,
  startOfDay,
} from '@/lib/calendar';
import type { CalendarEvent, CalendarEventInput } from '@/lib/database.types';
import { errorMessage } from '@/lib/supabase';
import { useEvents } from '@/providers/EventsProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, space } from '@/theme';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];
const ALL_DAY_SPANS = [
  { label: '1 jour', days: 1 },
  { label: '2 jours', days: 2 },
  { label: '3 jours', days: 3 },
  { label: '1 semaine', days: 7 },
];
const HOUR_W = 52;

type Who = 'me' | 'partner' | 'both';

type FormState = {
  title: string;
  who: Who;
  day: Date;
  allDay: boolean;
  hour: number;
  minute: number;
  durationMin: number | null; // événement à heure fixe
  spanDays: number; // journée entière
  location: string;
  reminder: number | null;
};

function initialState(existing: CalendarEvent | null, dateParam: string | undefined, myId?: string): FormState {
  if (existing) {
    const start = new Date(existing.starts_at);
    const end = existing.ends_at ? new Date(existing.ends_at) : null;
    return {
      title: existing.title,
      who: existing.for_user === null ? 'both' : existing.for_user === myId ? 'me' : 'partner',
      day: startOfDay(start),
      allDay: existing.all_day,
      hour: start.getHours(),
      minute: Math.round(start.getMinutes() / 15) * 15 === 60 ? 45 : Math.round(start.getMinutes() / 15) * 15,
      durationMin: end && !existing.all_day ? Math.round((end.getTime() - start.getTime()) / 60_000) : null,
      spanDays: end && existing.all_day ? Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS)) : 1,
      location: existing.location ?? '',
      reminder: existing.reminder_minutes,
    };
  }
  const now = new Date();
  const day = parseDayKey(dateParam) ?? startOfDay(now);
  return {
    title: '',
    who: 'both',
    day,
    allDay: false,
    hour: Math.min(23, now.getHours() + 1),
    minute: 0,
    durationMin: 60,
    spanDays: 1,
    location: '',
    reminder: 60,
  };
}

function Choice<T>({
  options,
  value,
  onChange,
  bg = colors.ink,
  fg = colors.white,
}: {
  options: { label: string; value: T; bg?: string; fg?: string }[];
  value: T;
  onChange: (v: T) => void;
  bg?: string;
  fg?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              minHeight: 40,
              paddingHorizontal: 14,
              borderRadius: 20,
              justifyContent: 'center',
              backgroundColor: active ? (o.bg ?? bg) : colors.ground,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <AppText variant="label" color={active ? (o.fg ?? fg) : colors.ink}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <AppText variant="overline">{children}</AppText>;
}

const fmtDuration = (m: number) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m} min`);

export default function EvenementScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const { byId, loading } = useEvents();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const existing = byId(id);

  if (id && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <AppText variant="title">Événement introuvable</AppText>
            <AppText color={colors.ink3}>Il a peut-être été supprimé depuis l&apos;autre téléphone.</AppText>
            <PrimaryButton label="Fermer" tone="ink" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }
  return (
    <EventForm
      key={existing?.id ?? 'nouveau'}
      existing={existing}
      dateParam={typeof params.date === 'string' ? params.date : undefined}
    />
  );
}

function EventForm({ existing, dateParam }: { existing: CalendarEvent | null; dateParam?: string }) {
  const insets = useSafeAreaInsets();
  const { create, update, remove } = useEvents();
  const { me, partner } = useHousehold();
  const editing = !!existing;

  const [f, setF] = useState<FormState>(() => initialState(existing, dateParam, me?.user_id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const whoOptions: { label: string; value: Who; bg: string; fg: string }[] = [
    ...(me ? [{ label: me.display_name, value: 'me' as const, bg: personColors[me.color].solid, fg: colors.ink }] : []),
    ...(partner
      ? [{ label: partner.display_name, value: 'partner' as const, bg: personColors[partner.color].solid, fg: colors.ink }]
      : []),
    { label: 'Ensemble', value: 'both', bg: colors.accent, fg: colors.white },
  ];

  const durationOptions = DURATION_OPTIONS.map((o) => ({ label: o.label, value: o.minutes }));
  if (f.durationMin !== null && !durationOptions.some((o) => o.value === f.durationMin)) {
    durationOptions.push({ label: fmtDuration(f.durationMin), value: f.durationMin });
  }
  const reminderOptions = f.allDay ? REMINDER_OPTIONS_ALL_DAY : REMINDER_OPTIONS_TIMED;

  const save = async () => {
    setError(null);
    const title = f.title.trim();
    if (!title) return setError('Donne un nom à l’événement.');
    const start = f.allDay
      ? new Date(f.day.getFullYear(), f.day.getMonth(), f.day.getDate())
      : new Date(f.day.getFullYear(), f.day.getMonth(), f.day.getDate(), f.hour, f.minute);
    const end = f.allDay
      ? f.spanDays > 1
        ? new Date(addDays(start, f.spanDays).getTime() - 60_000)
        : null
      : f.durationMin
        ? new Date(start.getTime() + f.durationMin * 60_000)
        : null;
    const input: CalendarEventInput = {
      title,
      starts_at: start.toISOString(),
      ends_at: end ? end.toISOString() : null,
      all_day: f.allDay,
      for_user: f.who === 'both' ? null : f.who === 'me' ? (me?.user_id ?? null) : (partner?.user_id ?? null),
      location: f.location.trim() || null,
      reminder_minutes: reminderOptions.some((o) => o.value === f.reminder) ? f.reminder : null,
    };
    setBusy(true);
    try {
      if (existing) await update(existing.id, input);
      else await create(input);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('Supprimer cet événement ?', existing.title, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(existing.id);
            router.back();
          } catch (e) {
            Alert.alert('Oups', errorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
        }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {editing ? 'Modifier' : 'Nouvel événement'}
        </AppText>
        {editing && <IconButton icon={Trash2} label="Supprimer l'événement" variant="tint" color={colors.danger} onPress={confirmDelete} />}
        <IconButton icon={X} label="Fermer" variant="tint" onPress={() => router.back()} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={space.xl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 120, gap: space.xl }}>
        <Field
          label="Quoi ?"
          value={f.title}
          onChangeText={(t) => set('title', t)}
          placeholder="Ex. Dîner chez Mamie"
          maxLength={120}
          autoFocus={!editing}
          returnKeyType="done"
        />

        <View style={{ gap: space.md }}>
          <Label>Pour qui ?</Label>
          <Choice options={whoOptions} value={f.who} onChange={(v) => set('who', v)} />
        </View>

        <View style={{ gap: space.md }}>
          <Label>Quel jour ?</Label>
          <MiniCalendar value={f.day} onChange={(d) => set('day', d)} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <AppText variant="overline" style={{ flex: 1 }}>
            Toute la journée
          </AppText>
          <Switch
            accessibilityLabel="Toute la journée"
            value={f.allDay}
            onValueChange={(v) => setF((p) => ({ ...p, allDay: v, reminder: v ? 1440 : 60 }))}
            trackColor={{ true: colors.accent, false: colors.mute }}
            thumbColor={colors.white}
          />
        </View>

        {f.allDay ? (
          <View style={{ gap: space.md }}>
            <Label>Combien de temps ?</Label>
            <Choice
              options={ALL_DAY_SPANS.map((s) => ({ label: s.label, value: s.days }))}
              value={f.spanDays}
              onChange={(v) => set('spanDays', v)}
            />
          </View>
        ) : (
          <>
            <View style={{ gap: space.md }}>
              <Label>À quelle heure ?</Label>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: Math.max(0, (f.hour - 2) * HOUR_W), y: 0 }}
                contentContainerStyle={{ gap: space.sm }}>
                {HOURS.map((h) => {
                  const active = h === f.hour;
                  return (
                    <Pressable
                      key={h}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${h} heures`}
                      onPress={() => set('hour', h)}
                      style={{
                        width: HOUR_W - space.sm,
                        height: 48,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? colors.accent : colors.ground,
                      }}>
                      <AppText variant="section" color={active ? colors.white : colors.ink}>
                        {String(h).padStart(2, '0')}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Choice
                options={MINUTES.map((m) => ({ label: `${String(f.hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`, value: m }))}
                value={f.minute}
                onChange={(v) => set('minute', v)}
                bg={colors.sun}
                fg={colors.ink}
              />
            </View>
            <View style={{ gap: space.md }}>
              <Label>Durée</Label>
              <Choice options={durationOptions} value={f.durationMin} onChange={(v) => set('durationMin', v)} />
            </View>
          </>
        )}

        <Field
          label="Où ? (facultatif)"
          value={f.location}
          onChangeText={(t) => set('location', t)}
          placeholder="Ex. Garage du centre"
          maxLength={120}
        />

        <View style={{ gap: space.md }}>
          <Label>Rappel sur le téléphone</Label>
          <Choice
            options={reminderOptions.map((o) => ({ label: o.label, value: o.value }))}
            value={f.reminder}
            onChange={(v) => set('reminder', v)}
            bg={colors.lagoon}
            fg={colors.ink}
          />
          <AppText variant="caption" color={colors.ink3}>
            Le rappel sonne sur le téléphone de la personne concernée (les deux pour « Ensemble »).
          </AppText>
        </View>
      </KeyboardAwareScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.lg,
          backgroundColor: colors.surface,
        }}>
        {error && (
          <AppText variant="label" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
        <PrimaryButton label={editing ? 'Enregistrer' : 'Ajouter à l’agenda'} loading={busy} onPress={save} />
      </View>
    </View>
  );
}
