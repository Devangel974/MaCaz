import { router } from 'expo-router';
import { Bell, LogOut, Share2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { AppText, Card, Field, IconButton, SecondaryButton, SectionTitle } from '@/components/ui';
import { registerForPushNotifications } from '@/lib/notifications';
import { errorMessage, supabase } from '@/lib/supabase';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, space } from '@/theme';

export default function FoyerScreen() {
  const insets = useSafeAreaInsets();
  const { household, members, me, updateMe, refresh, signOut } = useHousehold();
  const [name, setName] = useState(household?.name ?? '');
  const [pushState, setPushState] = useState<'idle' | 'busy' | 'ok' | 'off'>(me?.expo_push_token ? 'ok' : 'idle');

  if (!household || !me) return null;

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === household.name) return;
    const { error } = await supabase.from('households').update({ name: next }).eq('id', household.id);
    if (error) Alert.alert('Oups', errorMessage(error));
    else refresh();
  };

  const enablePush = async () => {
    setPushState('busy');
    const token = await registerForPushNotifications();
    if (token) {
      await updateMe({ expo_push_token: token });
      setPushState('ok');
    } else {
      setPushState('off');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.lg, gap: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">Notre foyer</AppText>
        <IconButton icon={X} label="Fermer" onPress={() => router.back()} />
      </View>

      <Field
        label="Nom du foyer"
        value={name}
        onChangeText={setName}
        onEndEditing={saveName}
        returnKeyType="done"
        maxLength={60}
      />

      <View style={{ gap: space.sm }}>
        <SectionTitle>Membres</SectionTitle>
        <Card style={{ paddingVertical: space.xs }}>
          {members.map((m, i) => (
            <View
              key={m.user_id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingVertical: space.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.lineSoft,
              }}>
              <Avatar member={m} size={40} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">
                  {m.display_name}
                  {m.user_id === me.user_id ? ' (toi)' : ''}
                </AppText>
                <AppText variant="caption" color={personColors[m.color].solid}>
                  {m.color === 'blue' ? 'Bleu' : 'Orange'} dans l&apos;appli
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      </View>

      {members.length < 2 && (
        <Card style={{ gap: space.md }}>
          <AppText variant="bodyStrong">Code d&apos;invitation</AppText>
          <AppText variant="title" style={{ letterSpacing: 6 }} selectable>
            {household.invite_code}
          </AppText>
          <SecondaryButton
            label="Partager le code"
            onPress={() =>
              Share.share({ message: `Rejoins notre foyer dans l'appli MaCaz avec le code ${household.invite_code}` })
            }
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Share2 size={14} color={colors.ink3} />
            <AppText variant="caption" color={colors.ink3}>
              Le foyer accepte 2 membres au total.
            </AppText>
          </View>
        </Card>
      )}

      <View style={{ gap: space.sm }}>
        <SectionTitle>Notifications</SectionTitle>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Bell size={22} color={colors.ink} strokeWidth={1.8} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Messages du foyer</AppText>
            <AppText variant="caption" color={pushState === 'off' ? colors.danger : colors.ink3}>
              {pushState === 'ok'
                ? 'Activées sur ce téléphone'
                : pushState === 'off'
                  ? 'Indisponibles : autorise-les dans les réglages Android (build de dev requis)'
                  : 'Pas encore activées'}
            </AppText>
          </View>
          {pushState !== 'ok' && (
            <Pressable accessibilityRole="button" onPress={enablePush} disabled={pushState === 'busy'} hitSlop={8}>
              <AppText variant="label" color={colors.accent}>
                Activer
              </AppText>
            </Pressable>
          )}
        </Card>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert('Se déconnecter ?', 'Tu ne recevras plus les notifications sur ce téléphone.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Se déconnecter', style: 'destructive', onPress: signOut },
          ])
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          height: 48,
          opacity: pressed ? 0.7 : 1,
        })}>
        <LogOut size={18} color={colors.danger} strokeWidth={1.8} />
        <AppText variant="label" color={colors.danger}>
          Se déconnecter
        </AppText>
      </Pressable>
    </ScrollView>
  );
}
