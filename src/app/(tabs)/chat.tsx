import { router, useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckCheck, MessageSquare, Send, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarPair } from '@/components/Avatar';
import { AppText, EmptyState, IconButton } from '@/components/ui';
import type { Member } from '@/lib/database.types';
import { formatDayLabel, formatTime, isSameDay } from '@/lib/dates';
import { dayKey, formatHour } from '@/lib/calendar';
import { eventOf, itemsOf } from '@/lib/messages';
import { setChatVisible } from '@/lib/notifications';
import { errorMessage } from '@/lib/supabase';
import { type ChatMessage, useChat } from '@/providers/ChatProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, radius, shadow, space, type } from '@/theme';

const GROUP_GAP_MS = 5 * 60 * 1000;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { household, members, me, partner, memberById } = useHousehold();
  const { loading, messages, remove, clearAll, hasMore, loadMore, send, markRead, partnerOnline, partnerTyping, notifyTyping } = useChat();
  const showEmpty = !loading && messages.length === 0 && !partnerTyping;
  const [draft, setDraft] = useState('');

  // Écran visible : pas de bannière push, et tout est marqué comme lu.
  useEffect(() => {
    setChatVisible(focused);
    return () => setChatVisible(false);
  }, [focused]);

  const newestId = messages[0]?.id;
  useEffect(() => {
    if (focused) markRead();
  }, [focused, newestId, markRead]);

  const myLastId = messages.find((m) => m.sender_id === me?.user_id && !m.pending)?.id;
  const seenByPartner = (m: ChatMessage) => !!partner && partner.last_read_at >= m.created_at;

  const onSend = async () => {
    const body = draft;
    if (!body.trim()) return;
    setDraft('');
    try {
      await send(body);
    } catch (e) {
      setDraft(body);
      Alert.alert('Message non envoyé', errorMessage(e));
    }
  };

  const confirmDelete = (m: ChatMessage) => {
    if (m.pending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const what =
      m.kind === 'text'
        ? 'Ce message'
        : m.kind === 'items_added'
          ? 'Cette carte (les articles restent dans la liste de courses)'
          : "Cette carte (l'événement reste dans l'agenda)";
    Alert.alert('Supprimer ?', `${what} sera supprimé pour vous deux.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => remove(m.id).catch((e) => Alert.alert('Oups', errorMessage(e))),
      },
    ]);
  };

  const confirmClear = () =>
    Alert.alert(
      'Vider la conversation ?',
      "Tous les messages et cartes seront supprimés pour vous deux. La liste de courses et l'agenda ne changent pas.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: () => clearAll().catch((e) => Alert.alert('Oups', errorMessage(e))),
        },
      ],
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.ground }}>
      {/* En-tête */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingTop: insets.top + space.lg,
          paddingBottom: 20,
          paddingHorizontal: space.lg,
          backgroundColor: colors.accent,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}>
        <AvatarPair members={members} size={44} ring={colors.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="section" color={colors.white} style={{ fontSize: 24, lineHeight: 28 }}>
            {household?.name ?? 'Notre caz'}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {partner && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: partnerOnline ? colors.online : colors.navInactive,
                }}
              />
            )}
            <AppText variant="caption" color={colors.white}>
              {!partner
                ? 'En attente de ta moitié'
                : partnerTyping
                  ? `${partner.display_name} écrit…`
                  : partnerOnline
                    ? `${partner.display_name} est en ligne`
                    : `${partner.display_name} est hors ligne`}
            </AppText>
          </View>
        </View>
        {messages.length > 0 && (
          <IconButton icon={Trash2} label="Vider la conversation" variant="plain" color={colors.white} onPress={confirmClear} />
        )}
      </View>

      {showEmpty ? (
        // Hors de la FlatList inversée : l'état vide s'affiche toujours à l'endroit.
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon={MessageSquare}
            tint={colors.accent}
            title="Votre fil à deux"
            description="Messages, et ajouts à la liste de courses : tout se retrouve ici."
          />
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => hasMore && loadMore()}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          ListHeaderComponent={partnerTyping ? <TypingBubble /> : null}
          renderItem={({ item, index }) => {
            const older = messages[index + 1];
            const newer = messages[index - 1];
            const showDay = !older || !isSameDay(older.created_at, item.created_at);
            const endOfRun =
              !newer ||
              newer.sender_id !== item.sender_id ||
              newer.kind !== item.kind ||
              Date.parse(newer.created_at) - Date.parse(item.created_at) > GROUP_GAP_MS;
            const mine = item.sender_id === me?.user_id;
            return (
              <View style={{ gap: space.sm }}>
                {showDay && <DaySeparator iso={item.created_at} />}
                {item.kind === 'items_added' ? (
                  <ItemsCard message={item} author={memberById(item.sender_id)} mine={mine} onLongPress={() => confirmDelete(item)} />
                ) : item.kind === 'event_added' ? (
                  <EventAddedCard
                    message={item}
                    author={memberById(item.sender_id)}
                    mine={mine}
                    memberById={memberById}
                    onLongPress={() => confirmDelete(item)}
                  />
                ) : (
                  <Bubble
                    onLongPress={() => confirmDelete(item)}
                    message={item}
                    mine={mine}
                    showMeta={endOfRun}
                    receipt={mine && item.id === myLastId ? (seenByPartner(item) ? 'Lu' : 'Envoyé') : null}
                  />
                )}
              </View>
            );
          }}
        />
      )}

      {/* Zone de saisie */}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: space.sm,
            marginHorizontal: space.lg,
            marginVertical: space.sm,
            padding: 6,
            borderRadius: 30,
            backgroundColor: colors.surface,
          },
          shadow.float,
        ]}>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (t.length) notifyTyping();
          }}
          placeholder="Message…"
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Message"
          multiline
          style={[
            type.body,
            {
              flex: 1,
              minHeight: 48,
              maxHeight: 120,
              paddingHorizontal: space.md,
              paddingTop: 13,
              paddingBottom: 13,
              color: colors.ink,
              textAlignVertical: 'center',
            },
          ]}
        />
        <IconButton icon={Send} label="Envoyer" variant="primary" size={48} onPress={onSend} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

function DaySeparator({ iso }: { iso: string }) {
  return (
    <View
      style={{
        alignSelf: 'center',
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        marginVertical: space.sm,
      }}>
      <AppText variant="label" color={colors.ink3}>
        {formatDayLabel(iso)}
      </AppText>
    </View>
  );
}

function Bubble({
  message,
  mine,
  showMeta,
  receipt,
  onLongPress,
}: {
  onLongPress: () => void;
  message: ChatMessage;
  mine: boolean;
  showMeta: boolean;
  receipt: 'Lu' | 'Envoyé' | null;
}) {
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start', gap: space.xs }}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityHint="Appui long pour supprimer"
        style={({ pressed }) => [
          { transform: [{ scale: pressed ? 0.98 : 1 }] },
          {
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            borderRadius: 22,
            backgroundColor: mine ? colors.accent : colors.surface,
            opacity: message.pending ? 0.7 : 1,
          },
          mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 },
        ]}>
        <AppText color={mine ? colors.white : colors.ink}>{message.body}</AppText>
      </Pressable>
      {(showMeta || receipt) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm }}>
          <AppText variant="caption" color={colors.ink3} style={{ fontVariant: ['tabular-nums'] }}>
            {message.pending ? 'Envoi…' : formatTime(message.created_at)}
            {receipt && !message.pending ? ` · ${receipt}` : ''}
          </AppText>
          {receipt === 'Lu' && !message.pending && <CheckCheck size={16} color={colors.accent} strokeWidth={2.4} />}
        </View>
      )}
    </View>
  );
}

const dowFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

function EventAddedCard({
  message,
  author,
  mine,
  memberById,
  onLongPress,
}: {
  message: ChatMessage;
  author: Member | null;
  mine: boolean;
  memberById: (id: string | null) => Member | null;
  onLongPress: () => void;
}) {
  const e = eventOf(message);
  if (!e) return null;
  const start = new Date(e.startsAt);
  const target = e.forUser ? memberById(e.forUser) : null;
  const bg = target ? personColors[target.color].solid : colors.lagoon;
  const who = mine ? 'Tu as' : `${author?.display_name ?? "Quelqu'un"} a`;
  const forWho = target ? `Pour ${target.display_name}` : 'Ensemble';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${who} ajouté ${e.title}. Voir dans l'agenda`}
      onPress={() => router.navigate({ pathname: '/agenda', params: { date: dayKey(start) } })}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        {
          alignSelf: mine ? 'flex-end' : 'flex-start',
          width: '80%',
          gap: space.sm,
          padding: space.md,
          paddingRight: space.lg,
          borderRadius: 22,
          backgroundColor: bg,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 },
      ]}>
      <AppText variant="label">{who} ajouté à l&apos;agenda</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText variant="label" style={{ lineHeight: 14, textTransform: 'uppercase' }}>
            {dowFmt.format(start).replace('.', '')}
          </AppText>
          <AppText variant="section" style={{ lineHeight: 22 }}>
            {start.getDate()}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {e.title}
          </AppText>
          <AppText variant="caption">
            {e.allDay ? 'Toute la journée' : formatHour(start)} · {forWho}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

function ItemsCard({
  message,
  author,
  mine,
  onLongPress,
}: {
  message: ChatMessage;
  author: Member | null;
  mine: boolean;
  onLongPress: () => void;
}) {
  const items = itemsOf(message);
  const who = mine ? 'Tu as' : `${author?.display_name ?? "Quelqu'un"} a`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${who} ajouté ${items.join(', ')}. Voir la liste`}
      onPress={() => router.navigate('/courses')}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        {
          alignSelf: mine ? 'flex-end' : 'flex-start',
          width: '80%',
          gap: 10,
          paddingHorizontal: space.lg,
          paddingVertical: 14,
          borderRadius: 22,
          backgroundColor: colors.sun,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        mine ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 },
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingBag size={15} color={colors.sun} strokeWidth={2.4} />
        </View>
        <AppText variant="label" style={{ flex: 1 }}>
          {who} ajouté {items.length > 1 ? `${items.length} articles` : '1 article'}
        </AppText>
        <AppText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
          {formatTime(message.created_at)}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {items.slice(0, 8).map((name, i) => (
          <View key={name + i} style={{ paddingHorizontal: 10, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: colors.white }}>
            <AppText variant="label">{name}</AppText>
          </View>
        ))}
        {items.length > 8 && (
          <View style={{ paddingHorizontal: 10, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: colors.sunSoft }}>
            <AppText variant="label">
              +{items.length - 8}
            </AppText>
          </View>
        )}
      </View>
      <AppText variant="label" style={{ textDecorationLine: 'underline' }}>
        Voir la liste
      </AppText>
    </Pressable>
  );
}

function TypingBubble() {
  return (
    <View
      accessibilityLabel="En train d'écrire"
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 5,
        paddingHorizontal: space.lg,
        paddingVertical: 14,
        borderRadius: 22,
        backgroundColor: colors.surface,
        marginTop: space.sm,
      }}>
      {[colors.coral, colors.sun, colors.lagoon].map((c, i) => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      ))}
    </View>
  );
}
