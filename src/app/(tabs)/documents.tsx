import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, FileText, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocIcon, ownerColor, ownerName } from '@/components/DocBits';
import { DocLock } from '@/components/DocLock';
import { AppText, Card, EmptyState, PrimaryButton } from '@/components/ui';
import { expiryStatus, formatShortDate, parseDate, shortStatus, STATUS_DOT, toRenew } from '@/lib/documents';
import { useDocuments } from '@/providers/DocumentsProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, radius, shadow, space } from '@/theme';

type Filter = 'all' | 'caz' | string; // string = user_id

export default function DocumentsScreen() {
  return (
    <DocLock>
      <DocumentsList />
    </DocLock>
  );
}

function DocumentsList() {
  const insets = useSafeAreaInsets();
  const { documents, loading, thumbs } = useDocuments();
  const { me, partner, memberById } = useHousehold();
  const [filter, setFilter] = useState<Filter>('all');

  const urgent = toRenew(documents);
  const shown = documents.filter((d) =>
    filter === 'all' ? true : filter === 'caz' ? d.owner_user === null : d.owner_user === filter,
  );

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    ...(me ? [{ id: me.user_id, label: me.display_name }] : []),
    ...(partner ? [{ id: partner.user_id, label: partner.display_name }] : []),
    { id: 'caz', label: 'La caz' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScrollView
        contentContainerStyle={{
          gap: space.lg,
          paddingTop: insets.top + space.xl,
          paddingHorizontal: space.lg,
          paddingBottom: 104,
        }}>
        <View style={{ gap: space.xs }}>
          <AppText variant="title">Papiers</AppText>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: space.xs,
              paddingHorizontal: 10,
              borderRadius: radius.pill,
              backgroundColor: colors.ink,
            }}>
            <Lock size={14} color={colors.lime} strokeWidth={2.4} />
            <AppText variant="label" color={colors.white}>
              Coffre verrouillé par empreinte
            </AppText>
          </View>
        </View>

        {urgent.length > 0 && (
          <Card bg={colors.coral} style={{ gap: space.sm }}>
            <AppText
              pointerEvents="none"
              variant="hero"
              color={colors.coralSoft}
              style={{ position: 'absolute', right: -6, bottom: -40, fontSize: 120, lineHeight: 130 }}>
              !
            </AppText>
            <AppText variant="section">
              {urgent.length} papier{urgent.length > 1 ? 's' : ''} à renouveler
            </AppText>
            {urgent.slice(0, 4).map((d) => {
              const exp = parseDate(d.expires_at);
              const who = d.owner_user ? ` de ${ownerName(d, memberById)}` : '';
              return (
                <Pressable key={d.id} onPress={() => router.push({ pathname: '/papier', params: { id: d.id } })} hitSlop={4}>
                  <AppText variant="caption">
                    {d.title}
                    {who}
                    {exp ? ` (${expiryStatus(d) === 'expired' ? 'expiré le ' : ''}${formatShortDate(exp)})` : ''}
                  </AppText>
                </Pressable>
              );
            })}
          </Card>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {filters.map((f) => {
            const active = f.id === filter;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f.id)}
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: 16,
                  borderRadius: 18,
                  justifyContent: 'center',
                  backgroundColor: active ? colors.ink : colors.surface,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <AppText variant="label" color={active ? colors.white : colors.ink}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && documents.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            tint={colors.coral}
            title="Aucun papier pour l'instant"
            description="Prends en photo un passeport, une carte ou une assurance : MaCaz en fait un PDF et te prévient avant l'expiration."
          />
        ) : shown.length === 0 ? (
          <AppText color={colors.ink3} style={{ textAlign: 'center', marginTop: space.xl }}>
            Rien dans cette catégorie.
          </AppText>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {shown.map((d) => {
              const owner = d.owner_user ? memberById(d.owner_user) : null;
              const status = expiryStatus(d);
              const thumb = thumbs[d.id];
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.title}, ${ownerName(d, memberById)}, ${shortStatus(d)}`}
                  onPress={() => router.push({ pathname: '/papier', params: { id: d.id } })}
                  style={({ pressed }) => ({
                    width: '47.5%',
                    flexGrow: 1,
                    gap: space.md,
                    padding: 14,
                    borderRadius: radius.tile,
                    backgroundColor: colors.surface,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {thumb ? (
                      <Image
                        source={{ uri: thumb, cacheKey: d.thumb_path ?? undefined }}
                        style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: ownerColor(owner) }}
                        contentFit="cover"
                      />
                    ) : (
                      <DocIcon type={d.doc_type} bg={ownerColor(owner)} />
                    )}
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_DOT[status] }} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {d.title}
                    </AppText>
                    <AppText variant="caption" color={status === 'expired' ? colors.danger : colors.ink3} numberOfLines={1}>
                      {ownerName(d, memberById)} · {shortStatus(d)}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PrimaryButton
        label="Ajouter un papier"
        icon={Camera}
        onPress={() => router.push('/papier-edition')}
        style={[{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }, shadow.primary]}
      />
    </View>
  );
}
