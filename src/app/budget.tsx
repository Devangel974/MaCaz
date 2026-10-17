import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Repeat, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, EmptyState, IconButton, PrimaryButton } from '@/components/ui';
import {
  capitalize,
  categoryInfo,
  formatBalance,
  formatDayLong,
  formatEuro,
  formatSigned,
  monthKeyOf,
  monthLabel,
  ofMonth,
  nextDue,
  parseDay,
  shiftMonth,
  summarize,
  toDay,
} from '@/lib/budget';
import type { BudgetOperation } from '@/lib/database.types';
import { useBudget } from '@/providers/BudgetProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, radius, shadow, space } from '@/theme';

type View_ = 'categories' | 'operations';

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ month?: string }>();
  const { operations, recurring, loading } = useBudget();
  const [month, setMonth] = useState(() =>
    typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKeyOf(new Date()),
  );
  const [view, setView] = useState<View_>('categories');

  const s = summarize(operations, month);
  const isCurrent = month === monthKeyOf(new Date());
  const active = recurring.filter((r) => r.active);
  const positive = s.balance >= 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
        }}>
        <IconButton icon={ChevronLeft} label="Retour" onPress={() => router.back()} />
        <AppText variant="title" style={{ flex: 1 }}>
          Budget
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.xs, borderRadius: 22, backgroundColor: colors.surface }}>
          <IconButton icon={ChevronLeft} label="Mois précédent" variant="plain" size={36} onPress={() => setMonth(shiftMonth(month, -1))} />
          <AppText variant="label" style={{ minWidth: 64, textAlign: 'center' }}>
            {capitalize(monthLabel(month))}
          </AppText>
          <IconButton
            icon={ChevronRight}
            label="Mois suivant"
            variant="plain"
            size={36}
            onPress={() => setMonth(shiftMonth(month, 1))}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 110, gap: 14 }}>
        {/* Solde */}
        <Card bg={positive ? colors.lime : colors.coral} style={{ gap: space.md }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -34,
              top: -34,
              width: 130,
              height: 130,
              borderRadius: 65,
              backgroundColor: positive ? '#A5E886' : colors.coralSoft,
            }}
          />
          <AppText variant="label">Solde {ofMonth(month)}</AppText>
          <AppText variant="hero" style={{ fontSize: 44, lineHeight: 50 }} adjustsFontSizeToFit numberOfLines={1}>
            {formatBalance(s.balance)}
          </AppText>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: 18, backgroundColor: colors.surface }}>
              <AppText variant="caption" color={colors.ink3}>
                Revenus
              </AppText>
              <AppText variant="bodyStrong">{formatEuro(s.income)}</AppText>
            </View>
            <View style={{ flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: 18, backgroundColor: colors.ink }}>
              <AppText variant="caption" color={colors.mute}>
                Dépenses
              </AppText>
              <AppText variant="bodyStrong" color={colors.white}>
                {formatEuro(s.expense)}
              </AppText>
            </View>
          </View>
        </Card>

        {/* Bascule */}
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: space.xs, borderRadius: 22, backgroundColor: colors.surface }}>
          {(
            [
              ['categories', 'Par catégorie'],
              ['operations', `Opérations (${s.ops.length})`],
            ] as const
          ).map(([id, label]) => {
            const on = view === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setView(id)}
                style={{ flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.ink : 'transparent' }}>
                <AppText variant="label" color={on ? colors.white : colors.ink}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {loading && operations.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
        ) : view === 'categories' ? (
          <>
            {s.byCategory.length === 0 ? (
              <EmptyState
                icon={Wallet}
                tint={colors.lime}
                title={isCurrent ? 'Rien ce mois-ci' : 'Aucune dépense'}
                description="Ajoute une dépense ou un revenu : le solde du mois se calcule tout seul."
              />
            ) : (
              <Card style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="bodyStrong">Dépenses par catégorie</AppText>
                  {s.income > 0 && (
                    <AppText variant="caption" color={colors.ink3}>
                      {Math.round((s.expense / s.income) * 100)} % des revenus
                    </AppText>
                  )}
                </View>
                <View
                  accessibilityRole="image"
                  accessibilityLabel="Répartition des dépenses"
                  style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 3 }}>
                  {s.byCategory.map((c) => (
                    <View key={c.info.id} style={{ flex: Math.max(c.cents, 1), backgroundColor: c.info.color }} />
                  ))}
                </View>
                {s.byCategory.map((c) => (
                  <View key={c.info.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Emoji emoji={c.info.emoji} bg={c.info.color} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <AppText variant="bodyStrong">{c.info.label}</AppText>
                      <AppText variant="caption" color={colors.ink3}>
                        {c.pct} % des dépenses
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong">−{formatEuro(c.cents)}</AppText>
                  </View>
                ))}
              </Card>
            )}

            {active.length > 0 && (
              <Card style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="bodyStrong">Chaque mois</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <Repeat size={14} color={colors.ink3} strokeWidth={2.4} />
                    <AppText variant="caption" color={colors.ink3}>
                      ajouté automatiquement
                    </AppText>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                  {active.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.label}, ${formatEuro(r.amount_cents)}, le ${r.day_of_month} de chaque mois`}
                      onPress={() => router.push({ pathname: '/operation', params: { rid: r.id } })}
                      style={({ pressed }) => ({
                        width: 112,
                        gap: 6,
                        padding: space.md,
                        borderRadius: 20,
                        backgroundColor: colors.ground,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}>
                      <AppText variant="caption" color={colors.ink3}>
                        le {r.day_of_month}
                      </AppText>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {r.label}
                      </AppText>
                      <AppText variant="label" color={r.kind === 'income' ? colors.okFg : colors.ink}>
                        {r.kind === 'income' ? '+' : ''}
                        {formatEuro(r.amount_cents)}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
                <AppText variant="caption" color={colors.ink3}>
                  Prochaine : {active
                    .map((r) => ({ r, d: nextDue(r) }))
                    .sort((a, b) => a.d.getTime() - b.d.getTime())
                    .slice(0, 1)
                    .map(({ r, d }) => `${r.label}, ${formatDayLong(d).toLowerCase()}`)}
                </AppText>
              </Card>
            )}
          </>
        ) : s.ops.length === 0 ? (
          <EmptyState icon={Wallet} tint={colors.lime} title="Aucune opération" description="Rien n’a été noté pour ce mois." />
        ) : (
          <OperationsList ops={s.ops} />
        )}
      </ScrollView>

      <PrimaryButton
        label="Ajouter une opération"
        icon={Plus}
        onPress={() =>
          router.push({ pathname: '/operation-edition', params: isCurrent ? {} : { date: `${month}-01` } })
        }
        style={[{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.lg }, shadow.primary]}
      />
    </View>
  );
}

function Emoji({ emoji, bg }: { emoji: string; bg: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</AppText>
    </View>
  );
}

function OperationsList({ ops }: { ops: BudgetOperation[] }) {
  const { memberById } = useHousehold();
  // Groupement par jour (déjà triées du plus récent au plus ancien)
  const groups: { day: string; ops: BudgetOperation[] }[] = [];
  for (const o of ops) {
    const last = groups[groups.length - 1];
    if (last && last.day === o.op_date) last.ops.push(o);
    else groups.push({ day: o.op_date, ops: [o] });
  }
  const todayIso = toDay(new Date());

  return (
    <View style={{ gap: space.sm }}>
      {groups.map((g) => (
        <View key={g.day} style={{ gap: space.sm }}>
          <AppText variant="label" color={colors.ink3} style={{ marginTop: space.xs }}>
            {g.day === todayIso ? "Aujourd'hui" : formatDayLong(parseDay(g.day))}
          </AppText>
          <View style={{ borderRadius: radius.tile, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: space.xs }}>
            {g.ops.map((o, i) => {
              const info = categoryInfo(o.category);
              const who = o.paid_by ? (memberById(o.paid_by)?.display_name ?? '—') : 'Compte commun';
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.label}, ${formatSigned(o.amount_cents, o.kind)}, ${who}`}
                  onPress={() => router.push({ pathname: '/operation', params: { id: o.id } })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    minHeight: 60,
                    opacity: pressed ? 0.7 : 1,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: colors.lineSoft,
                  })}>
                  <Emoji emoji={info.emoji} bg={info.color} />
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {o.label}
                    </AppText>
                    <AppText variant="caption" color={colors.ink3} numberOfLines={1}>
                      {who}
                      {o.recurring_id ? ' · chaque mois' : ''}
                    </AppText>
                  </View>
                  <AppText
                    variant="bodyStrong"
                    color={o.kind === 'income' ? colors.okFg : colors.ink}
                    style={
                      o.kind === 'income'
                        ? { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.okBg, overflow: 'hidden' }
                        : undefined
                    }>
                    {formatSigned(o.amount_cents, o.kind)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
