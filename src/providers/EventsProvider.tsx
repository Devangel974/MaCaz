import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { CalendarEvent, CalendarEventInput } from '@/lib/database.types';
import { syncReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';

import { useHousehold } from './HouseholdProvider';

type EventsContextValue = {
  loading: boolean;
  /** Triés par date de début. Depuis 30 jours en arrière. */
  events: CalendarEvent[];
  byId: (id: string | undefined) => CalendarEvent | null;
  create: (input: CalendarEventInput) => Promise<CalendarEvent>;
  update: (id: string, patch: CalendarEventInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

const byStart = (a: CalendarEvent, b: CalendarEvent) => a.starts_at.localeCompare(b.starts_at);

async function fetchEvents() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  // Les événements longs commencés avant `since` mais pas finis restent visibles.
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .or(`starts_at.gte.${since},ends_at.gte.${since}`)
    .order('starts_at');
  if (error) console.warn('[agenda] chargement', error.message);
  return data;
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const { household, me } = useHousehold();
  const householdId = household?.id;
  const myId = me?.user_id;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data: CalendarEvent[] | null) => {
    if (data) setEvents(data);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (householdId) apply(await fetchEvents());
  }, [householdId, apply]);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetchEvents().then((data) => {
      if (!cancelled) apply(data);
    });
    return () => {
      cancelled = true;
    };
  }, [householdId, apply]);

  // Temps réel : ajouts / modifications de l'autre téléphone.
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`events:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as CalendarEvent;
          setEvents((prev) => [...prev.filter((e) => e.id !== row.id), row].sort(byStart));
        },
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, (payload) => {
        const id = (payload.old as Partial<CalendarEvent>).id;
        if (id) setEvents((prev) => prev.filter((e) => e.id !== id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  // Rappels locaux, recalculés à chaque changement.
  useEffect(() => {
    if (!loading) syncReminders(events, myId);
  }, [events, myId, loading]);

  const value = useMemo<EventsContextValue>(
    () => ({
      loading,
      events,
      byId: (id) => events.find((e) => e.id === id) ?? null,
      async create(input) {
        if (!householdId) throw new Error('Pas de foyer');
        const { data, error } = await supabase
          .from('events')
          .insert({ ...input, household_id: householdId })
          .select()
          .single();
        if (error) throw error;
        setEvents((prev) => [...prev.filter((e) => e.id !== data.id), data].sort(byStart));
        return data;
      },
      async update(id, patch) {
        const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single();
        if (error) throw error;
        setEvents((prev) => [...prev.filter((e) => e.id !== id), data].sort(byStart));
      },
      async remove(id) {
        const before = events;
        setEvents((prev) => prev.filter((e) => e.id !== id));
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) {
          setEvents(before);
          throw error;
        }
      },
    }),
    [events, householdId, loading],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents doit être utilisé dans <EventsProvider>');
  return ctx;
}
