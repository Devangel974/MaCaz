import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ExternalLink, Pencil, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocIcon, ownerColor, ownerName } from '@/components/DocBits';
import { DocLock } from '@/components/DocLock';
import { AppText, Card, Chip, IconButton, PrimaryButton, SecondaryButton } from '@/components/ui';
import type { HouseDocument } from '@/lib/database.types';
import {
  daysLeft,
  DOC_TYPE_LABEL,
  expiryStatus,
  formatLongDate,
  formatShortDate,
  formatSize,
  parseDate,
  REMIND_OPTIONS,
} from '@/lib/documents';
import { errorMessage } from '@/lib/supabase';
import { useDocuments } from '@/providers/DocumentsProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, radius, space } from '@/theme';

const HINTS: Partial<Record<HouseDocument['doc_type'], string>> = {
  passeport: 'Pense à prendre rendez-vous en mairie (délais parfois longs).',
  identite: 'Pense à prendre rendez-vous en mairie (délais parfois longs).',
  permis: 'Renouvellement en ligne sur le site de l’ANTS.',
  carte_grise: 'Démarches en ligne sur le site de l’ANTS.',
  assurance: 'Compare les offres avant l’échéance du contrat.',
};

function remindLabel(days: number) {
  return REMIND_OPTIONS.find((o) => o.days === days)?.label ?? `${days} j avant`;
}

export default function PapierScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  return (
    <DocLock>
      <PapierDetail id={typeof params.id === 'string' ? params.id : undefined} />
    </DocLock>
  );
}

function PapierDetail({ id }: { id?: string }) {
  const insets = useSafeAreaInsets();
  const { byId, loading, thumbs, open, share, remove, save } = useDocuments();
  const { memberById } = useHousehold();
  const doc = byId(id);
  const [busy, setBusy] = useState<'open' | 'share' | 'agenda' | null>(null);

  if (!doc) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ground, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <AppText variant="title">Papier introuvable</AppText>
            <AppText color={colors.ink3}>Il a peut-être été supprimé depuis l&apos;autre téléphone.</AppText>
            <PrimaryButton label="Retour aux papiers" tone="ink" onPress={() => router.navigate('/documents')} />
          </>
        )}
      </View>
    );
  }

  const owner = doc.owner_user ? memberById(doc.owner_user) : null;
  const exp = parseDate(doc.expires_at);
  const left = daysLeft(doc);
  const status = expiryStatus(doc);
  const thumb = thumbs[doc.id];
  const lead = Math.max(0, ...doc.remind_days);
  const agendaDay = exp ? new Date(exp.getFullYear(), exp.getMonth(), exp.getDate() - lead) : null;

  const big =
    left === null
      ? null
      : left < 0
        ? { n: '!', unit: 'expiré' }
        : left >= 60
          ? { n: String(Math.round(left / 30.4)), unit: 'mois' }
          : { n: String(left), unit: left > 1 ? 'jours' : 'jour' };
  const blockBg = status === 'expired' || status === 'soon' ? colors.coral : status === 'ok' ? colors.lime : colors.surface;

  const run = async (kind: 'open' | 'share', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Oups', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleAgenda = async (on: boolean) => {
    setBusy('agenda');
    try {
      await save(
        {
          title: doc.title,
          doc_type: doc.doc_type,
          owner_user: doc.owner_user,
          expires_at: doc.expires_at,
          remind_days: doc.remind_days,
          notes: doc.notes,
          addToAgenda: on,
        },
        { kind: 'none' },
        doc,
      );
    } catch (e) {
      Alert.alert('Oups', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Supprimer ce papier ?', `${doc.title} et son PDF seront effacés pour vous deux.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(doc);
            router.back();
          } catch (e) {
            Alert.alert('Oups', errorMessage(e));
          }
        },
      },
    ]);

  const fileInfo = [
    'PDF',
    doc.page_count ? `${doc.page_count} page${doc.page_count > 1 ? 's' : ''}` : null,
    formatSize(doc.size_bytes) || null,
  ]
    .filter(Boolean)
    .join(' · ');

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
        <IconButton icon={ChevronLeft} label="Retour aux papiers" onPress={() => router.back()} />
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="section" numberOfLines={1} style={{ fontSize: 26, lineHeight: 30 }}>
            {doc.title}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ownerColor(owner) }} />
            <AppText variant="label" color={colors.ink3}>
              {ownerName(doc, memberById)} · {DOC_TYPE_LABEL[doc.doc_type]}
            </AppText>
          </View>
        </View>
        <IconButton
          icon={Pencil}
          label="Modifier"
          onPress={() => router.push({ pathname: '/papier-edition', params: { id: doc.id } })}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 120, gap: space.lg }}>
        {/* Aperçu */}
        <Card style={{ alignItems: 'center', gap: space.md }}>
          {thumb ? (
            <Image
              source={{ uri: thumb, cacheKey: doc.thumb_path ?? undefined }}
              accessibilityLabel="Aperçu de la page 1"
              style={{ width: '100%', aspectRatio: 1.45, borderRadius: 18, backgroundColor: colors.ground }}
              contentFit="contain"
            />
          ) : (
            <View
              style={{
                width: '100%',
                aspectRatio: 1.9,
                borderRadius: 18,
                backgroundColor: colors.ground,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <DocIcon type={doc.doc_type} bg={ownerColor(owner)} size={72} />
            </View>
          )}
          <AppText variant="label" color={colors.ink3}>
            {doc.file_path ? fileInfo : 'Pas encore de fichier'}
          </AppText>
        </Card>

        {/* Échéance */}
        <Card bg={blockBg} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          {big && (
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 24,
                backgroundColor: colors.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText variant="title" color={colors.white} style={{ lineHeight: 36 }}>
                {big.n}
              </AppText>
              <AppText variant="label" color={colors.white} style={{ marginTop: -4 }}>
                {big.unit}
              </AppText>
            </View>
          )}
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="bodyStrong">
              {exp ? `${status === 'expired' ? 'A expiré le' : 'Expire le'} ${formatLongDate(exp)}` : 'Sans date d’expiration'}
            </AppText>
            <AppText variant="caption" color={status === 'none' ? colors.ink3 : colors.ink}>
              {exp ? (HINTS[doc.doc_type] ?? 'MaCaz vous préviendra tous les deux.') : 'Aucun rappel pour ce papier.'}
            </AppText>
          </View>
        </Card>

        {/* Rappels */}
        {exp && (
          <Card style={{ gap: space.md }}>
            <AppText variant="section">Rappels</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {doc.remind_days.length === 0 ? (
                <AppText color={colors.ink3}>Aucun rappel</AppText>
              ) : (
                doc.remind_days.map((d) => <Chip key={d} label={remindLabel(d)} bg={colors.sun} />)
              )}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.md,
                borderRadius: radius.field,
                backgroundColor: colors.ground,
              }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Dans l&apos;agenda</AppText>
                <AppText variant="caption" color={colors.ink3}>
                  {agendaDay ? `« Renouveler : ${doc.title} » le ${formatShortDate(agendaDay)}` : ''}
                </AppText>
              </View>
              {busy === 'agenda' ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Switch
                  accessibilityLabel="Ajouter à l'agenda"
                  value={!!doc.agenda_event_id}
                  onValueChange={toggleAgenda}
                  trackColor={{ true: colors.accent, false: colors.mute }}
                  thumbColor={colors.white}
                />
              )}
            </View>
          </Card>
        )}

        {/* Notes */}
        {!!doc.notes && (
          <Card style={{ gap: space.sm }}>
            <AppText variant="section">Notes</AppText>
            <AppText selectable>{doc.notes}</AppText>
          </Card>
        )}

        <SecondaryButton
          label="Supprimer ce papier"
          bg={colors.surface}
          onPress={confirmDelete}
          accessibilityHint="Efface la fiche et le PDF"
        />
      </ScrollView>

      {!!doc.file_path && (
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
            backgroundColor: colors.ground,
          }}>
          <PrimaryButton
            label="Ouvrir le PDF"
            icon={ExternalLink}
            loading={busy === 'open'}
            onPress={() => run('open', () => open(doc))}
            style={{ flex: 1.4, paddingHorizontal: space.md }}
          />
          <PrimaryButton
            label="Partager"
            icon={Share2}
            tone="ink"
            loading={busy === 'share'}
            onPress={() => run('share', () => share(doc))}
            style={{ flex: 1, paddingHorizontal: space.md }}
          />
        </View>
      )}
    </View>
  );
}
