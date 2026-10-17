import { router } from 'expo-router';
import { CalendarDays, MessageSquare, Settings, Share2, ShoppingBag } from 'lucide-react-native';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarPair } from '@/components/Avatar';
import { AppText, Card, Chip, IconButton, SegmentBar } from '@/components/ui';
import { formatEventWhen, formatHour, occursOn, sameDay } from '@/lib/calendar';
import { formatTime, formatToday, greeting } from '@/lib/dates';
import { preview } from '@/lib/messages';
import { useChat } from '@/providers/ChatProvider';
import { useEvents } from '@/providers/EventsProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { useShopping } from '@/providers/ShoppingProvider';
import { colors, radius, space } from '@/theme';

function IconTile({ icon: Icon, bg, color }: { icon: typeof ShoppingBag; bg: string; color: string }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} color={color} strokeWidth={2.2} />
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { me, partner, members, household, memberById } = useHousehold();
  const { items, toBuy, inCart } = useShopping();
  const { lastMessage, unreadCount } = useChat();
  const { events } = useEvents();

  const now = new Date();
  const todayCount = events.filter((e) => occursOn(e, now)).length;
  // Prochain événement : en cours ou à venir (journée entière d'aujourd'hui incluse).
  const next = events.find((e) =>
    e.all_day ? occursOn(e, now) || new Date(e.starts_at) > now : new Date(e.ends_at ?? e.starts_at) >= now,
  );

  const total = items.length;
  const salut = greeting() === 'Bonsoir' ? 'Bonsoir' : 'Salut';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{
        gap: space.lg,
        paddingTop: insets.top + space.xl,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
      }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ gap: space.xs, flex: 1 }}>
          <Chip label={formatToday()} color={colors.ink3} style={{ alignSelf: 'flex-start', paddingVertical: space.xs }} />
          <AppText variant="title" numberOfLines={1}>
            {salut} {me?.display_name}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Membres de la caz, ouvrir les réglages"
            onPress={() => router.push('/reglages')}
            hitSlop={8}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            <AvatarPair members={members} />
          </Pressable>
          <IconButton icon={Settings} label="Réglages" onPress={() => router.push('/reglages')} />
        </View>
      </View>

      {/* Invitation tant que le foyer n'a qu'un membre */}
      {!partner && household && (
        <Card bg={colors.accent} style={{ gap: space.md }}>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.sun }}
          />
          <AppText variant="section" color={colors.white}>
            Invite ta moitié
          </AppText>
          <AppText variant="caption" color={colors.white} style={{ maxWidth: 230 }}>
            Après avoir créé son compte, elle choisit « J&apos;ai un code » et saisit :
          </AppText>
          <AppText variant="hero" color={colors.white} style={{ letterSpacing: 6, fontSize: 40, lineHeight: 44 }} selectable>
            {household.invite_code}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Share.share({ message: `Rejoins notre caz dans l'appli MaCaz avec le code ${household.invite_code}` })
            }
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              height: 40,
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              backgroundColor: colors.white,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}>
            <Share2 size={16} color={colors.accent} strokeWidth={2.4} />
            <AppText variant="label" color={colors.accent}>
              Partager le code
            </AppText>
          </Pressable>
        </Card>
      )}

      {/* Courses — grand bloc tournesol */}
      <Card bg={colors.sun} onPress={() => router.navigate('/courses')} accessibilityLabel="Ouvrir la liste de courses" style={{ gap: space.md, padding: 20 }}>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: -28, top: -28, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.sunDeep }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <IconTile icon={ShoppingBag} bg={colors.ink} color={colors.sun} />
            <AppText variant="bodyStrong">Courses</AppText>
          </View>
          <Chip label={total === 0 ? 'Ajouter' : 'Ouvrir'} bg={colors.ink} color={colors.white} />
        </View>
        {total === 0 ? (
          <AppText variant="section">La liste est vide</AppText>
        ) : toBuy.length === 0 ? (
          <AppText variant="section">Tout est dans le panier !</AppText>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <AppText variant="hero">{toBuy.length}</AppText>
            <AppText variant="bodyStrong">article{toBuy.length > 1 ? 's' : ''} à prendre</AppText>
          </View>
        )}
        {total > 0 && <SegmentBar done={inCart.length} total={total} />}
        {toBuy.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {toBuy.slice(0, 3).map((i) => (
              <Chip key={i.id} label={i.name} />
            ))}
            {toBuy.length > 3 && <Chip label={`+${toBuy.length - 3}`} bg={colors.sunSoft} />}
          </View>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        {/* Chat — bloc violet */}
        <Card
          bg={colors.accent}
          onPress={() => router.navigate('/chat')}
          accessibilityLabel={unreadCount > 0 ? `Chat, ${unreadCount} non lu` : 'Ouvrir le chat'}
          style={{ flex: 1, minHeight: 176, justifyContent: 'space-between', gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconTile icon={MessageSquare} bg={colors.white} color={colors.accent} />
            {unreadCount > 0 && <Chip label={String(unreadCount)} bg={colors.sun} style={{ paddingVertical: 3, paddingHorizontal: 9 }} />}
          </View>
          {lastMessage ? (
            <View style={{ gap: space.xs }}>
              <AppText variant="label" color={colors.white}>
                {memberById(lastMessage.sender_id)?.display_name ?? 'MaCaz'} · {formatTime(lastMessage.created_at)}
              </AppText>
              <AppText color={colors.white} numberOfLines={3}>
                {preview(lastMessage)}
              </AppText>
            </View>
          ) : (
            <AppText color={colors.white}>Pas encore de message</AppText>
          )}
        </Card>

        {/* Agenda — bloc lagon */}
        <Card
          bg={colors.lagoon}
          onPress={() => router.navigate('/agenda')}
          accessibilityLabel={`Agenda : ${todayCount} événement${todayCount > 1 ? 's' : ''} aujourd'hui`}
          style={{ flex: 1, minHeight: 176, justifyContent: 'space-between', gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconTile icon={CalendarDays} bg={colors.ink} color={colors.lagoon} />
            <AppText variant="title">{todayCount}</AppText>
          </View>
          {next ? (
            <View style={{ gap: space.xs }}>
              <AppText variant="label">
                {sameDay(new Date(next.starts_at), new Date())
                  ? next.all_day
                    ? "Aujourd'hui"
                    : `Prochain · ${formatHour(new Date(next.starts_at))}`
                  : formatEventWhen(next.starts_at, next.all_day)}
              </AppText>
              <AppText numberOfLines={3}>{next.title}</AppText>
            </View>
          ) : (
            <AppText>Rien de prévu. On s&apos;organise ?</AppText>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
