import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { firstOfMonth, parseDay, shiftMonth, toDay } from '@/lib/budget';
import type { BudgetCategory, BudgetOperation, BudgetRecurring, OperationKind } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import { useHousehold } from './HouseholdProvider';

export type OperationInput = {
  kind: OperationKind;
  amount_cents: number;
  label: string;
  category: BudgetCategory;
  paid_by: string | null;
  op_date: string; // "2026-10-17"
  notes: string | null;
  /** Chaque mois, au même jour. */
  repeat: boolean;
};

type BudgetContextValue = {
  loading: boolean;
  /** Toutes les opérations, les plus récentes d'abord. */
  operations: BudgetOperation[];
  /** Récurrences (actives et arrêtées). */
  recurring: BudgetRecurring[];
  opById: (id: string | undefined) => BudgetOperation | null;
  recurringById: (id: string | null | undefined) => BudgetRecurring | null;
  save: (input: OperationInput, existing?: BudgetOperation | null) => Promise<void>;
  remove: (op: BudgetOperation) => Promise<void>;
  stopRecurring: (id: string) => Promise<void>;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

const newestFirst = (a: BudgetOperation, b: BudgetOperation) =>
  b.op_date.localeCompare(a.op_date) || b.created_at.localeCompare(a.created_at);

async function fetchAll() {
  // Opérations dues avant de charger : les deux téléphones voient la même chose.
  const { error: rpcError } = await supabase.rpc('apply_recurring');
  if (rpcError) console.warn('[budget] récurrences', rpcError.message);
  const [ops, rec] = await Promise.all([
    supabase.from('budget_operations').select('*').order('op_date', { ascending: false }).limit(3000),
    supabase.from('budget_recurring').select('*').order('day_of_month'),
  ]);
  if (ops.error) console.warn('[budget] chargement', ops.error.message);
  if (rec.error) console.warn('[budget] récurrences', rec.error.message);
  return { ops: ops.data, rec: rec.data };
}

function fields(input: OperationInput) {
  return {
    kind: input.kind,
    amount_cents: input.amount_cents,
    label: input.label,
    category: input.category,
    paid_by: input.paid_by,
    notes: input.notes,
  };
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id;
  const [operations, setOperations] = useState<BudgetOperation[]>([]);
  const [recurring, setRecurring] = useState<BudgetRecurring[]>([]);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    if (data.ops) setOperations([...data.ops].sort(newestFirst));
    if (data.rec) setRecurring(data.rec);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (householdId) apply(await fetchAll());
  }, [householdId, apply]);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetchAll().then((data) => {
      if (!cancelled) apply(data);
    });
    // Retour au premier plan (ex. le lendemain) : les récurrences du jour s'ajoutent.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchAll().then((data) => !cancelled && apply(data));
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [householdId, apply]);

  // Temps réel
  useEffect(() => {
    if (!householdId) return;
    const filter = `household_id=eq.${householdId}`;
    const channel = supabase
      .channel(`budget:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_operations', filter }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as BudgetOperation;
        setOperations((prev) => [...prev.filter((o) => o.id !== row.id), row].sort(newestFirst));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'budget_operations' }, (payload) => {
        const id = (payload.old as Partial<BudgetOperation>).id;
        if (id) setOperations((prev) => prev.filter((o) => o.id !== id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_recurring', filter }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as BudgetRecurring;
        setRecurring((prev) => [...prev.filter((r) => r.id !== row.id), row].sort((a, b) => a.day_of_month - b.day_of_month));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  const recurringById = useCallback((id: string | null | undefined) => recurring.find((r) => r.id === id) ?? null, [recurring]);

  const value = useMemo<BudgetContextValue>(
    () => ({
      loading,
      operations,
      recurring,
      opById: (id) => operations.find((o) => o.id === id) ?? null,
      recurringById,

      async save(input, existing) {
        if (!householdId) throw new Error('Pas de caz');
        const day = parseDay(input.op_date).getDate();

        if (!existing) {
          if (input.repeat) {
            // La récurrence crée elle-même l'opération du mois (aujourd'hui ou plus tard).
            const { error } = await supabase.from('budget_recurring').insert({
              ...fields(input),
              household_id: householdId,
              day_of_month: day,
              next_month: firstOfMonth(input.op_date),
            });
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('budget_operations')
              .insert({ ...fields(input), household_id: householdId, op_date: input.op_date });
            if (error) throw error;
          }
          await load();
          return;
        }

        const { error } = await supabase
          .from('budget_operations')
          .update({ ...fields(input), op_date: input.op_date })
          .eq('id', existing.id);
        if (error) throw error;

        const rec = recurringById(existing.recurring_id);
        if (rec?.active && input.repeat) {
          // Les mois suivants suivent la modification.
          const r = await supabase
            .from('budget_recurring')
            .update({ ...fields(input), day_of_month: day })
            .eq('id', rec.id);
          if (r.error) throw r.error;
        } else if (rec?.active && !input.repeat) {
          const r = await supabase.from('budget_recurring').update({ active: false }).eq('id', rec.id);
          if (r.error) throw r.error;
        } else if (input.repeat) {
          // Opération ponctuelle qui devient mensuelle : on repart du mois suivant.
          const month = firstOfMonth(input.op_date);
          const { data, error: e2 } = await supabase
            .from('budget_recurring')
            .insert({
              ...fields(input),
              household_id: householdId,
              day_of_month: day,
              next_month: `${shiftMonth(month.slice(0, 7), 1)}-01`,
            })
            .select()
            .single();
          if (e2) throw e2;
          await supabase
            .from('budget_operations')
            .update({ recurring_id: data.id, recurring_month: month })
            .eq('id', existing.id);
        }
        await load();
      },

      async remove(op) {
        const before = operations;
        setOperations((prev) => prev.filter((o) => o.id !== op.id));
        const { error } = await supabase.from('budget_operations').delete().eq('id', op.id);
        if (error) {
          setOperations(before);
          throw error;
        }
      },

      async stopRecurring(id) {
        const { error } = await supabase.from('budget_recurring').update({ active: false }).eq('id', id);
        if (error) throw error;
        setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, active: false } : r)));
      },
    }),
    [loading, operations, recurring, recurringById, householdId, load],
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error('useBudget doit être utilisé dans <BudgetProvider>');
  return ctx;
}

/** Date du jour au format "2026-10-17". */
export const todayIso = () => toDay(new Date());
