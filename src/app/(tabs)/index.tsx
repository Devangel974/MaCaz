import { router } from 'expo-router';
import { CalendarDays, ChevronRight, Share2 } from 'lucide-react-native';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, AvatarPair } from '@/components/Avatar';
import { AppText, Card, Chip, ProgressBar } from '@/components/ui';
import { formatTime, formatToday, greeting } from '@/lib/dates';
import { preview } from '@/lib/messages';
import { useChat } from '@/providers/ChatProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { useShopping } from '@/providers/ShoppingProvider';
import { colors, radius, space } from '@/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { me, partner, members, household, memberById } = useHousehold();
  const { items, toBuy } = useShopping();
  const { lastMessage, unreadCount } = useChat();

  const total = items.length;
  const done = total - toBuy.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{
        gap: space.xl,
        paddingTop: insets.top + space.xl,
        paddingBottom: space.xl,
        paddingHorizontal: space.lg,
      }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg }}>
        <View style={{ gap: space.xs, flex: 1 }}>
          <AppText variant="caption" color={colors.ink3}>
            {formatToday()}
          </AppText>
          <AppText variant="title" numberOfLines={1}>
            {greeting()} {me?.display_name}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réglages du foyer"
          onPress={() => router.push('/foyer')}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: space.xs })}>
          <AvatarPair members={members} />
        </Pressable>
      </View>

      {/* Invitation tant que le foyer n'a qu'un membre */}
      {!partner && household && (
        <Card style={{ gap: space.md, backgroundColor: colors.accentSoft, boxShadow: undefined }}>
          <AppText variant="bodyStrong">Invite ta moitié</AppText>
          <AppText variant="caption" color={colors.ink2}>
            Après avoir créé son compte, elle choisit « J&apos;ai un code » et saisit :
          </AppText>
          <AppText variant="title" style={{ letterSpacing: 6 }} selectable>
            {household.invite_code}
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Share.share({ message: `Rejoins notre foyer dans l'appli MaCaz avec le code ${household.invite_code}` })
            }
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              height: 40,
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.8 : 1,
            })}>
            <Share2 size={16} color={colors.accent} strokeWidth={2} />
            <AppText variant="label" color={colors.accent}>
              Partager le code
            </AppText>
          </Pressable>
        </Card>
      )}

      {/* Courses */}
      <Card onPress={() => router.navigate('/courses')} accessibilityLabel="Ouvrir la liste de courses" style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="section">Liste de courses</AppText>
            <AppText variant="caption" color={colors.ink3}>
              {total === 0
                ? 'La liste est vide'
                : toBuy.length === 0
                  ? 'Tout est dans le panier'
                  : `${toBuy.length} article${toBuy.length > 1 ? 's' : ''} restant${toBuy.length > 1 ? 's' : ''} sur ${total}`}
            </AppText>
          </View>
          <AppText variant="label" color={colors.accent}>
            {total === 0 ? 'Ajouter' : 'Ouvrir'}
          </AppText>
        </View>
        {total > 0 && <ProgressBar value={done / total} />}
        {toBuy.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {toBuy.slice(0, 3).map((i) => (
              <Chip key={i.id} label={i.name} />
            ))}
            {toBuy.length > 3 && <Chip label={`+${toBuy.length - 3}`} muted />}
          </View>
        )}
      </Card>

      {/* Dernier message */}
      <Card
        onPress={() => router.navigate('/chat')}
        accessibilityLabel="Ouvrir le chat"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {lastMessage ? (
          <>
            <Avatar member={memberById(lastMessage.sender_id)} size={40} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <AppText variant="bodyStrong">{memberById(lastMessage.sender_id)?.display_name ?? 'MaCaz'}</AppText>
                <AppText variant="caption" color={colors.ink3} style={{ fontVariant: ['tabular-nums'] }}>
                  {formatTime(lastMessage.created_at)}
                </AppText>
              </View>
              <AppText color={colors.ink2} numberOfLines={1}>
                {preview(lastMessage)}
              </AppText>
            </View>
            {unreadCount > 0 && (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 6,
                  borderRadius: 10,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText variant="label" color={colors.white} style={{ fontSize: 12, lineHeight: 16 }}>
                  {unreadCount}
                </AppText>
              </View>
            )}
          </>
        ) : (
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="section">Chat du foyer</AppText>
            <AppText variant="caption" color={colors.ink3}>
              Aucun message pour l&apos;instant
            </AppText>
          </View>
        )}
      </Card>

      {/* Agenda — étape suivante */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate('/agenda')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.mute,
          opacity: pressed ? 0.7 : 1,
        })}>
        <CalendarDays size={20} color={colors.ink3} strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" color={colors.ink2}>
            Agenda partagé
          </AppText>
          <AppText variant="caption" color={colors.ink3}>
            Arrive dans la prochaine version
          </AppText>
        </View>
        <ChevronRight size={20} color={colors.ink3} strokeWidth={1.8} />
      </Pressable>
    </ScrollView>
  );
}

