import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Repeat, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Switch, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniCalendar } from '@/components/MiniCalendar';
import { AppText, Field, IconButton, PrimaryButton } from '@/components/ui';
import {
  categoriesFor,
  centsToInput,
  formatDayLong,
  maskAmount,
  parseAmount,
  parseDay,
  toDay,
} from '@/lib/budget';
import type { BudgetCategory, BudgetOperation, OperationKind } from '@/lib/database.types';
import { errorMessage } from '@/lib/supabase';
import { useBudget } from '@/providers/BudgetProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, radius, space, type } from '@/theme';

type Payer = 'me' | 'partner' | 'common';

type FormState = {
  kind: OperationKind;
  amount: string;
  label: string;
  category: BudgetCategory;
  payer: Payer;
  date: string;
  repeat: boolean;
  notes: string;
};

export default function OperationEditionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; date?: string; kind?: string }>();
  const { opById, loading } = useBudget();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const existing = opById(id);

  if (id && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <AppText variant="title">Opération introuvable</AppText>
            <PrimaryButton label="Fermer" tone="ink" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }
  return (
    <OperationForm
      key={existing?.id ?? 'nouvelle'}
      existing={existing}
      dateParam={typeof params.date === 'string' ? params.date : undefined}
      kindParam={params.kind === 'income' ? 'income' : 'expense'}
    />
  );
}

function Label({ children }: { children: string }) {
  return <AppText variant="overline">{children}</AppText>;
}

function Pill({ label, active, onPress, bg = colors.ink, fg = colors.white, emoji }: {
  label: string;
  active: boolean;
  onPress: () => void;
  bg?: string;
  fg?: string;
  emoji?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        paddingLeft: emoji ? space.sm : 14,
        paddingRight: 14,
        borderRadius: 20,
        backgroundColor: active ? bg : colors.ground,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}>
      {emoji && <AppText style={{ fontSize: 16, lineHeight: 20 }}>{emoji}</AppText>}
      <AppText variant="label" color={active ? fg : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

function OperationForm({
  existing,
  dateParam,
  kindParam,
}: {
  existing: BudgetOperation | null;
  dateParam?: string;
  kindParam: OperationKind;
}) {
  const insets = useSafeAreaInsets();
  const { save, recurringById } = useBudget();
  const { me, partner } = useHousehold();
  const editing = !!existing;
  const rec = recurringById(existing?.recurring_id);

  const [f, setF] = useState<FormState>(() => ({
    kind: existing?.kind ?? kindParam,
    amount: existing ? centsToInput(existing.amount_cents) : '',
    label: existing?.label ?? '',
    category: existing?.category ?? (kindParam === 'income' ? 'salaire' : 'courses'),
    payer: !existing ? 'me' : existing.paid_by === null ? 'common' : existing.paid_by === me?.user_id ? 'me' : 'partner',
    date: existing?.op_date ?? (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toDay(new Date())),
    repeat: !!rec?.active,
    notes: existing?.notes ?? '',
  }));
  const [showCal, setShowCal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const switchKind = (kind: OperationKind) =>
    setF((p) => (p.kind === kind ? p : { ...p, kind, category: kind === 'income' ? 'salaire' : 'courses' }));

  const day = parseDay(f.date);
  const isToday = f.date === toDay(new Date());
  const cats = categoriesFor(f.kind);
  const catInfo = cats.find((c) => c.id === f.category);

  const submit = async () => {
    setError(null);
    const cents = parseAmount(f.amount);
    if (!cents) return setError('Indique un montant (ex. 35,90).');
    setBusy(true);
    try {
      await save(
        {
          kind: f.kind,
          amount_cents: cents,
          label: f.label.trim() || catInfo?.label || 'Opération',
          category: f.category,
          paid_by: f.payer === 'common' ? null : f.payer === 'me' ? (me?.user_id ?? null) : (partner?.user_id ?? null),
          op_date: f.date,
          notes: f.notes.trim() || null,
          repeat: f.repeat,
        },
        existing,
      );
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const payers: { label: string; value: Payer; bg: string; fg: string }[] = [
    ...(me ? [{ label: me.display_name, value: 'me' as const, bg: personColors[me.color].solid, fg: colors.ink }] : []),
    ...(partner
      ? [{ label: partner.display_name, value: 'partner' as const, bg: personColors[partner.color].solid, fg: colors.ink }]
      : []),
    { label: 'Compte commun', value: 'common', bg: colors.accent, fg: colors.white },
  ];

  const repeatHint = !f.repeat
    ? 'Loyer, abonnements, salaire…'
    : day.getDate() > 28
      ? `Ajoutée automatiquement le ${day.getDate()} (ou le dernier jour du mois)`
      : `Ajoutée automatiquement le ${day.getDate()} de chaque mois`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.sm,
        }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {editing ? 'Modifier' : 'Nouvelle opération'}
        </AppText>
        <IconButton icon={X} label="Fermer" variant="tint" onPress={() => router.back()} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={space.xl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 130, gap: 20 }}>
        {/* Dépense / revenu */}
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: space.xs, borderRadius: 22, backgroundColor: colors.ground }}>
          {(
            [
              ['expense', 'Dépense'],
              ['income', 'Revenu'],
            ] as const
          ).map(([k, label]) => {
            const on = f.kind === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => switchKind(k)}
                style={{ flex: 1, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.ink : 'transparent' }}>
                <AppText variant="label" color={on ? colors.white : colors.ink}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Montant + libellé */}
        <View
          style={{
            alignItems: 'center',
            gap: 6,
            padding: 18,
            borderRadius: radius.card,
            backgroundColor: f.kind === 'income' ? colors.lime : colors.sun,
          }}>
          <AppText variant="label">Montant</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <TextInput
              accessibilityLabel="Montant en euros"
              value={f.amount}
              onChangeText={(t) => set('amount', maskAmount(t))}
              placeholder="0"
              placeholderTextColor={colors.ink3}
              keyboardType="decimal-pad"
              autoFocus={!editing}
              style={[type.hero, { minWidth: 80, maxWidth: 240, textAlign: 'right', color: colors.ink, padding: 0 }]}
            />
            <AppText variant="title">€</AppText>
          </View>
          <TextInput
            accessibilityLabel="Libellé"
            value={f.label}
            onChangeText={(t) => set('label', t)}
            placeholder={catInfo ? `Ex. ${f.kind === 'income' ? 'Salaire Sarah' : 'Leclerc'}` : 'Libellé'}
            placeholderTextColor={colors.ink3}
            maxLength={80}
            style={[
              type.body,
              { alignSelf: 'stretch', height: 44, paddingHorizontal: space.lg, borderRadius: 16, backgroundColor: colors.surface, color: colors.ink, textAlign: 'center' },
            ]}
          />
        </View>

        <View style={{ gap: space.md }}>
          <Label>Catégorie</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {cats.map((c) => (
              <Pill
                key={c.id}
                label={c.label}
                emoji={c.emoji}
                active={f.category === c.id}
                onPress={() => set('category', c.id)}
                bg={c.color}
                fg={colors.ink}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: space.md }}>
          <Label>{f.kind === 'income' ? 'Reçu par' : 'Payé par'}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {payers.map((p) => (
              <Pill key={p.value} label={p.label} active={f.payer === p.value} onPress={() => set('payer', p.value)} bg={p.bg} fg={p.fg} />
            ))}
          </View>
        </View>

        {/* Date + récurrence */}
        <View style={{ borderRadius: radius.tile, backgroundColor: colors.ground, paddingHorizontal: space.lg, paddingVertical: space.xs }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date : ${formatDayLong(day)}. Changer`}
            onPress={() => setShowCal((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 }}>
            <CalendarDays size={22} color={colors.ink} strokeWidth={2} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {isToday ? `Aujourd'hui, ${formatDayLong(day).toLowerCase()}` : formatDayLong(day)}
            </AppText>
            <AppText variant="caption" color={colors.accent}>
              {showCal ? 'OK' : 'Changer'}
            </AppText>
          </Pressable>
          {showCal && (
            <View style={{ paddingBottom: space.md }}>
              <MiniCalendar
                value={day}
                onChange={(d) => {
                  set('date', toDay(d));
                  setShowCal(false);
                }}
              />
            </View>
          )}
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 }}>
            <Repeat size={22} color={colors.ink} strokeWidth={2} />
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyStrong">Chaque mois</AppText>
              <AppText variant="caption" color={colors.ink3}>
                {repeatHint}
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Répéter chaque mois"
              value={f.repeat}
              onValueChange={(v) => set('repeat', v)}
              trackColor={{ true: colors.accent, false: colors.mute }}
              thumbColor={colors.white}
            />
          </View>
        </View>
        {editing && rec?.active && (
          <AppText variant="caption" color={colors.ink3} style={{ marginTop: -space.md }}>
            Les modifications s&apos;appliquent aussi aux prochains mois. Désactive « Chaque mois » pour arrêter la répétition.
          </AppText>
        )}

        <Field
          label="Note (facultatif)"
          value={f.notes}
          onChangeText={(t) => set('notes', t)}
          placeholder="Ex. à résilier en janvier"
          maxLength={500}
        />
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
        <PrimaryButton
          label={editing ? 'Enregistrer' : f.kind === 'income' ? 'Enregistrer le revenu' : 'Enregistrer la dépense'}
          loading={busy}
          onPress={submit}
        />
      </View>
    </View>
  );
}
