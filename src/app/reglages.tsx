import { router } from 'expo-router';
import { Bell, CalendarDays, FileText, LogOut, Share2, ShoppingBag, Wallet, X, type LucideIcon } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { AppText, Card, Field, IconButton, SecondaryButton } from '@/components/ui';
import type { HouseholdUpdate } from '@/lib/database.types';
import { registerForPushNotifications } from '@/lib/notifications';
import { errorMessage } from '@/lib/supabase';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, space } from '@/theme';

/** Écran Réglages : regroupe les options de la caz, du chat, du téléphone et du compte. */
export default function ReglagesScreen() {
  const insets = useSafeAreaInsets();
  const { household, members, me, updateMe, updateHousehold, signOut } = useHousehold();
  const [name, setName] = useState(household?.name ?? '');
  const [pushState, setPushState] = useState<'idle' | 'busy' | 'ok' | 'off'>(me?.expo_push_token ? 'ok' : 'idle');

  if (!household || !me) return null;

  const saveHousehold = (patch: HouseholdUpdate) =>
    updateHousehold(patch).catch((e) => Alert.alert('Oups', errorMessage(e)));

  const saveName = () => {
    const next = name.trim();
    if (next && next !== household.name) saveHousehold({ name: next });
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
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: insets.bottom + space.xxl,
        paddingHorizontal: space.lg,
        gap: space.xl,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">Réglages</AppText>
        <IconButton icon={X} label="Fermer" onPress={() => router.back()} />
      </View>

      {/* ------------------------------------------------ Notre caz */}
      <Section title="Notre caz">
        <Card style={{ gap: space.lg }}>
          <Field
            label="Nom de la caz"
            value={name}
            onChangeText={setName}
            onEndEditing={saveName}
            returnKeyType="done"
            maxLength={60}
          />
          <View>
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
                  <AppText variant="caption" color={colors.ink3}>
                    {personColors[m.color].label} dans l&apos;appli
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {members.length < 2 && (
          <Card style={{ gap: space.md }}>
            <AppText variant="bodyStrong">Code d&apos;invitation</AppText>
            <AppText variant="title" style={{ letterSpacing: 6 }} selectable>
              {household.invite_code}
            </AppText>
            <SecondaryButton
              label="Partager le code"
              onPress={() =>
                Share.share({ message: `Rejoins notre caz dans l'appli MaCaz avec le code ${household.invite_code}` })
              }
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Share2 size={14} color={colors.ink3} />
              <AppText variant="caption" color={colors.ink3}>
                La caz accepte 2 membres au total.
              </AppText>
            </View>
          </Card>
        )}
      </Section>

      {/* ------------------------------------------------ Chat */}
      <Section title="Chat" note="Réglages communs : ils s'appliquent à vous deux.">
        <Card style={{ paddingVertical: space.xs }}>
          <ToggleRow
            icon={ShoppingBag}
            tint={colors.sun}
            title="Articles ajoutés à la liste"
            description="Une carte dans le chat (et une notification) quand l'un de vous ajoute des courses."
            value={household.chat_show_shopping}
            onChange={(v) => saveHousehold({ chat_show_shopping: v })}
          />
          <ToggleRow
            icon={CalendarDays}
            tint={colors.lagoon}
            title="Événements de l'agenda"
            description="Une carte dans le chat (et une notification) à chaque nouvel événement."
            value={household.chat_show_events}
            onChange={(v) => saveHousehold({ chat_show_events: v })}
            divider
          />
          <ToggleRow
            icon={FileText}
            tint={colors.coral}
            title="Papiers"
            description="Une carte quand un papier est ajouté, et quand il arrive à expiration."
            value={household.chat_show_documents}
            onChange={(v) => saveHousehold({ chat_show_documents: v })}
            divider
          />
          <ToggleRow
            icon={Wallet}
            tint={colors.lime}
            title="Budget"
            description="Une carte quand l'un de vous note une dépense ou un revenu (pas pour les opérations automatiques)."
            value={household.chat_show_budget}
            onChange={(v) => saveHousehold({ chat_show_budget: v })}
            divider
          />
        </Card>
      </Section>

      {/* ------------------------------------------------ Ce téléphone */}
      <Section title="Ce téléphone">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon={Bell} tint={colors.accentSoft} color={colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">Notifications</AppText>
            <AppText variant="caption" color={pushState === 'off' ? colors.danger : colors.ink3}>
              {pushState === 'ok'
                ? 'Activées sur ce téléphone'
                : pushState === 'off'
                  ? 'Indisponibles : autorise-les dans les réglages Android'
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
      </Section>

      {/* ------------------------------------------------ Compte */}
      <Section title="Compte">
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
            gap: space.md,
            padding: space.lg,
            borderRadius: 28,
            backgroundColor: colors.surface,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
          <IconTile icon={LogOut} tint="#FFE1D9" color={colors.danger} />
          <AppText variant="bodyStrong" color={colors.danger}>
            Se déconnecter
          </AppText>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ paddingHorizontal: space.xs, gap: 2 }}>
        <AppText variant="section">{title}</AppText>
        {note && (
          <AppText variant="caption" color={colors.ink3}>
            {note}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

function IconTile({ icon: Icon, tint, color = colors.ink }: { icon: LucideIcon; tint: string; color?: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={20} color={color} strokeWidth={2.2} />
    </View>
  );
}

function ToggleRow({
  icon,
  tint,
  title,
  description,
  value,
  onChange,
  divider,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.lineSoft,
      }}>
      <IconTile icon={icon} tint={tint} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={colors.ink3}>
          {description}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.mute }}
        thumbColor={colors.white}
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}
