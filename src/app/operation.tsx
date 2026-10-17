import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Pencil, Repeat, StickyNote, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { AppText, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui';
import { categoryInfo, formatDayLong, formatSigned, nextDue, parseDay } from '@/lib/budget';
import { errorMessage } from '@/lib/supabase';
import { useBudget } from '@/providers/BudgetProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, radius, space } from '@/theme';

function Row({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 56,
        paddingVertical: space.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.line,
      }}>
      {children}
    </View>
  );
}

export default function OperationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; rid?: string }>();
  const { opById, recurringById, loading, remove, stopRecurring } = useBudget();
  const { memberById } = useHousehold();
  const [busy, setBusy] = useState(false);

  const op = opById(typeof params.id === 'string' ? params.id : undefined);
  const rec = recurringById(op ? op.recurring_id : typeof params.rid === 'string' ? params.rid : undefined);
  const item = op ?? rec;

  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <AppText variant="title">Opération introuvable</AppText>
            <AppText color={colors.ink3}>Elle a peut-être été supprimée depuis l&apos;autre téléphone.</AppText>
            <PrimaryButton label="Fermer" tone="ink" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }

  const info = categoryInfo(item.category);
  const payer = item.paid_by ? memberById(item.paid_by) : null;
  const author = memberById(item.created_by);

  const confirmDelete = () => {
    if (!op) return;
    Alert.alert(
      'Supprimer cette opération ?',
      rec?.active ? `${op.label} : seule celle-ci est supprimée, les prochains mois restent prévus.` : op.label,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(op);
              router.back();
            } catch (e) {
              Alert.alert('Oups', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const confirmStop = () => {
    if (!rec) return;
    Alert.alert('Arrêter la répétition ?', `${rec.label} ne sera plus ajoutée les prochains mois. Les opérations déjà passées restent.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await stopRecurring(rec.id);
            if (!op) router.back();
          } catch (e) {
            Alert.alert('Oups', errorMessage(e));
          } finally {
            setBusy(false);
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
          justifyContent: 'space-between',
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.sm,
        }}>
        <IconButton icon={X} label="Fermer" variant="tint" onPress={() => router.back()} />
        {op && (
          <IconButton
            icon={Pencil}
            label="Modifier"
            variant="tint"
            onPress={() => router.push({ pathname: '/operation-edition', params: { id: op.id } })}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 120, gap: space.lg }}>
        <View
          style={{
            alignItems: 'center',
            gap: space.sm,
            paddingVertical: space.xl,
            paddingHorizontal: space.lg,
            borderRadius: radius.card,
            backgroundColor: info.color,
            overflow: 'hidden',
          }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: -30, bottom: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.white, opacity: 0.25 }}
          />
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 22,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-6deg' }],
            }}>
            <AppText style={{ fontSize: 30, lineHeight: 36 }}>{info.emoji}</AppText>
          </View>
          <AppText variant="hero" style={{ fontSize: 44, lineHeight: 50 }} adjustsFontSizeToFit numberOfLines={1}>
            {formatSigned(item.amount_cents, item.kind)}
          </AppText>
          <AppText variant="section" style={{ textAlign: 'center' }}>
            {item.label}
          </AppText>
          <View style={{ paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.ink }}>
            <AppText variant="label" color={colors.white}>
              {info.label}
            </AppText>
          </View>
        </View>

        <View style={{ borderRadius: radius.tile, backgroundColor: colors.ground, paddingHorizontal: space.lg, paddingVertical: space.xs }}>
          <Row first>
            {payer ? (
              <Avatar member={payer} size={28} />
            ) : (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent }} />
            )}
            <AppText style={{ flex: 1 }}>
              {item.kind === 'income' ? 'Reçu par ' : 'Payé par '}
              <AppText variant="bodyStrong">{payer?.display_name ?? 'Compte commun'}</AppText>
            </AppText>
          </Row>
          <Row>
            <CalendarDays size={24} color={colors.ink} strokeWidth={2} />
            <AppText style={{ flex: 1 }}>{op ? formatDayLong(parseDay(op.op_date)) : rec ? `Prochaine : ${formatDayLong(nextDue(rec))}` : ''}</AppText>
          </Row>
          {rec && (
            <Row>
              <Repeat size={24} color={colors.ink} strokeWidth={2} />
              <AppText style={{ flex: 1 }}>Se répète chaque mois le {rec.day_of_month}</AppText>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: space.xs,
                  borderRadius: radius.pill,
                  backgroundColor: rec.active ? colors.lime : colors.mute,
                }}>
                <AppText variant="label">{rec.active ? 'Actif' : 'Arrêtée'}</AppText>
              </View>
            </Row>
          )}
          {!!item.notes && (
            <Row>
              <StickyNote size={24} color={colors.ink} strokeWidth={2} />
              <AppText style={{ flex: 1 }} selectable>
                {item.notes}
              </AppText>
            </Row>
          )}
        </View>

        <AppText variant="caption" color={colors.ink3} style={{ textAlign: 'center' }}>
          {[
            op?.recurring_id ? 'Ajoutée automatiquement' : author ? `Ajoutée par ${author.display_name}` : null,
            rec?.active ? `prochaine ${formatDayLong(nextDue(rec)).toLowerCase()}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.lg,
          backgroundColor: colors.surface,
        }}>
        {op && <SecondaryButton label="Supprimer" bg={colors.ground} onPress={confirmDelete} style={{ flex: 1, height: 56, borderRadius: 28 }} />}
        {rec?.active && (
          <PrimaryButton
            label="Arrêter la répétition"
            tone="ink"
            loading={busy}
            onPress={confirmStop}
            style={{ flex: 1.4, paddingHorizontal: space.md }}
          />
        )}
      </View>
    </View>
  );
}
