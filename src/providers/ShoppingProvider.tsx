import * as Haptics from 'expo-haptics';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ShoppingItem } from '@/lib/database.types';
import { categorize, normalize, parseItem } from '@/lib/shopping';
import { supabase } from '@/lib/supabase';

import { useHousehold } from './HouseholdProvider';

type ShoppingContextValue = {
  loading: boolean;
  items: ShoppingItem[];
  toBuy: ShoppingItem[];
  inCart: ShoppingItem[];
  suggestions: string[];
  add: (input: string) => Promise<void>;
  toggle: (item: ShoppingItem) => Promise<void>;
  remove: (item: ShoppingItem) => Promise<void>;
  clearCart: () => Promise<void>;
  uncheckAll: () => Promise<void>;
};

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

async function fetchShopping() {
  const [active, past] = await Promise.all([
    supabase.from('shopping_items').select('*').is('archived_at', null).order('created_at'),
    supabase
      .from('shopping_items')
      .select('name')
      .not('archived_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);
  return { active: active.data, history: past.data?.map((r) => r.name) ?? null };
}

const byCreated = (a: ShoppingItem, b: ShoppingItem) => a.created_at.localeCompare(b.created_at);

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchShopping>>) => {
    if (data.active) setItems(data.active);
    if (data.history) setHistory(data.history);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (householdId) apply(await fetchShopping());
  }, [householdId, apply]);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetchShopping().then((data) => {
      if (!cancelled) apply(data);
    });
    return () => {
      cancelled = true;
    };
  }, [householdId, apply]);

  // Synchronisation temps réel entre les deux téléphones.
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`shopping:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as ShoppingItem;
          setItems((prev) => {
            const rest = prev.filter((i) => i.id !== row.id);
            return row.archived_at ? rest : [...rest, row].sort(byCreated);
          });
        },
      )
      // Les DELETE ne passent pas par les filtres de colonne : écoute séparée (seul l'id est transmis).
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_items' }, (payload) => {
        const id = (payload.old as Partial<ShoppingItem>).id;
        if (id) setItems((prev) => prev.filter((i) => i.id !== id));
      })
      // Resynchronisation complète à chaque (re)connexion.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  const toBuy = useMemo(() => items.filter((i) => !i.checked), [items]);
  const inCart = useMemo(
    () => items.filter((i) => i.checked).sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? '')),
    [items],
  );

  // "Souvent" : articles les plus fréquents de l'historique, absents de la liste actuelle.
  const suggestions = useMemo(() => {
    const current = new Set(items.map((i) => normalize(i.name)));
    const counts = new Map<string, { name: string; n: number }>();
    for (const name of history) {
      const k = normalize(name);
      if (current.has(k)) continue;
      const e = counts.get(k);
      if (e) e.n += 1;
      else counts.set(k, { name, n: 1 });
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 3).map((e) => e.name);
  }, [history, items]);

  const patchLocal = (id: string, patch: Partial<ShoppingItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const value: ShoppingContextValue = {
    loading,
    items,
    toBuy,
    inCart,
    suggestions,
    async add(input) {
      if (!householdId) return;
      const { name, quantity } = parseItem(input);
      if (!name) return;
      const existing = items.find((i) => normalize(i.name) === normalize(name));
      if (existing) {
        // Déjà dans la liste : on le remet "à acheter" plutôt que de créer un doublon.
        if (existing.checked) await value.toggle(existing);
        return;
      }
      const { data, error } = await supabase
        .from('shopping_items')
        .insert({ household_id: householdId, name, quantity, category: categorize(name) })
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => (prev.some((i) => i.id === data.id) ? prev : [...prev, data].sort(byCreated)));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    async toggle(item) {
      const checked = !item.checked;
      patchLocal(item.id, { checked, checked_at: checked ? new Date().toISOString() : null });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (checked && toBuy.length === 1 && toBuy[0].id === item.id) {
        // Dernier article : petit moment de satisfaction.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const { error } = await supabase.from('shopping_items').update({ checked }).eq('id', item.id);
      if (error) {
        patchLocal(item.id, { checked: item.checked, checked_at: item.checked_at });
        throw error;
      }
    },
    async remove(item) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      const { error } = await supabase.from('shopping_items').delete().eq('id', item.id);
      if (error) {
        load();
        throw error;
      }
    },
    async clearCart() {
      const ids = inCart.map((i) => i.id);
      if (!ids.length) return;
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      setHistory((prev) => [...inCart.map((i) => i.name), ...prev]);
      const { error } = await supabase
        .from('shopping_items')
        .update({ archived_at: new Date().toISOString() })
        .in('id', ids);
      if (error) {
        load();
        throw error;
      }
    },
    async uncheckAll() {
      const ids = inCart.map((i) => i.id);
      if (!ids.length) return;
      setItems((prev) => prev.map((i) => ({ ...i, checked: false, checked_at: null })));
      const { error } = await supabase.from('shopping_items').update({ checked: false }).in('id', ids);
      if (error) load();
    },
  };

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

export function useShopping() {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error('useShopping doit être utilisé dans <ShoppingProvider>');
  return ctx;
}
