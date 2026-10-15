import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Database, Household, Member } from '@/lib/database.types';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

import { useAuth } from './AuthProvider';

type MemberUpdate = Database['public']['Tables']['household_members']['Update'];

type HouseholdContextValue = {
  loading: boolean;
  household: Household | null;
  members: Member[];
  me: Member | null;
  partner: Member | null;
  memberById: (id: string | null | undefined) => Member | null;
  createHousehold: (displayName: string) => Promise<void>;
  joinHousehold: (code: string, displayName: string) => Promise<void>;
  updateMe: (patch: MemberUpdate) => Promise<void>;
  refresh: () => Promise<void>;
  /** Déconnexion propre : on retire le jeton push de ce téléphone avant. */
  signOut: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

type LoadedState = { userId: string; household: Household | null; members: Member[] };

async function fetchHousehold(userId: string): Promise<LoadedState> {
  // RLS : on ne voit que les membres de son propre foyer.
  const { data: rows, error } = await supabase.from('household_members').select('*').order('joined_at');
  if (error) console.warn('[foyer] chargement des membres', error.message);
  if (!rows || !rows.some((m) => m.user_id === userId)) return { userId, household: null, members: [] };
  const { data: household } = await supabase.from('households').select('*').single();
  return { userId, household: household ?? null, members: rows };
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session, signOut: authSignOut } = useAuth();
  const userId = session?.user.id ?? null;

  const [state, setState] = useState<LoadedState | null>(null);

  // Données valables uniquement pour l'utilisateur courant (changement de compte = rechargement).
  const current = state && state.userId === userId ? state : null;
  const loading = !!userId && !current;
  const household = current?.household ?? null;
  const members = useMemo(() => current?.members ?? [], [current]);

  const load = useCallback(async () => {
    if (!userId) return;
    setState(await fetchHousehold(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchHousehold(userId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Arrivée du second membre, accusés de lecture, changements de prénom…
  const householdId = household?.id;
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`members:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  const me = useMemo(() => members.find((m) => m.user_id === userId) ?? null, [members, userId]);
  const partner = useMemo(() => members.find((m) => m.user_id !== userId) ?? null, [members, userId]);

  const updateMe = useCallback(
    async (patch: MemberUpdate) => {
      if (!userId) return;
      setState((prev) =>
        prev ? { ...prev, members: prev.members.map((m) => (m.user_id === userId ? { ...m, ...patch } : m)) } : prev,
      );
      const { error } = await supabase.from('household_members').update(patch).eq('user_id', userId);
      if (error) console.warn('[foyer] mise à jour du profil', error.message);
    },
    [userId],
  );

  // Enregistre le jeton push de ce téléphone dès qu'on fait partie d'un foyer.
  const myToken = me?.expo_push_token;
  const hasMe = !!me;
  useEffect(() => {
    if (!hasMe) return;
    let cancelled = false;
    registerForPushNotifications().then((token) => {
      if (!cancelled && token && token !== myToken) updateMe({ expo_push_token: token });
    });
    return () => {
      cancelled = true;
    };
  }, [hasMe, myToken, updateMe]);

  const value: HouseholdContextValue = {
    loading,
    household,
    members,
    me,
    partner,
    memberById: (id) => members.find((m) => m.user_id === id) ?? null,
    async createHousehold(displayName) {
      const { error } = await supabase.rpc('create_household', { p_display_name: displayName.trim() });
      if (error) throw error;
      await load();
    },
    async joinHousehold(code, displayName) {
      const { error } = await supabase.rpc('join_household', {
        p_code: code.trim().toUpperCase(),
        p_display_name: displayName.trim(),
      });
      if (error) throw error;
      await load();
    },
    updateMe,
    refresh: load,
    async signOut() {
      if (me?.expo_push_token) await updateMe({ expo_push_token: null });
      await authSignOut();
    },
  };

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold doit être utilisé dans <HouseholdProvider>');
  return ctx;
}
