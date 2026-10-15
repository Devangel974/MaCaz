import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Field, PrimaryButton } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, radius, space, type } from '@/theme';

type Choice = 'create' | 'join';

export default function FoyerSetupScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { createHousehold, joinHousehold } = useHousehold();
  const [choice, setChoice] = useState<Choice>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Indique ton prénom.');
    if (choice === 'join' && code.trim().length !== 6) return setError('Le code fait 6 caractères.');
    setBusy(true);
    try {
      if (choice === 'create') await createHousehold(name);
      else await joinHousehold(code, name);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={space.xl}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={{
        flexGrow: 1,
        gap: space.xxl,
        paddingTop: insets.top + 72,
        paddingBottom: insets.bottom + space.xxl,
        paddingHorizontal: space.xl,
      }}>
      <View style={{ gap: space.sm }}>
        <AppText variant="title">Votre foyer</AppText>
        <AppText color={colors.ink2}>
          Le premier crée le foyer et reçoit un code. L&apos;autre le rejoint avec ce code.
        </AppText>
      </View>

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          gap: space.xs,
          padding: space.xs,
          borderRadius: radius.field,
          backgroundColor: colors.line,
        }}>
        {(
          [
            ['create', 'Créer notre foyer'],
            ['join', "J'ai un code"],
          ] as const
        ).map(([id, label]) => {
          const selected = choice === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setChoice(id)}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.surface : 'transparent',
                boxShadow: selected ? '0 1px 2px rgba(22,32,30,0.08)' : undefined,
              }}>
              <AppText variant={selected ? 'label' : 'caption'} color={selected ? colors.ink : colors.ink2}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: space.lg }}>
        <Field
          label="Ton prénom"
          value={name}
          onChangeText={setName}
          placeholder="Ex. Julien"
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={40}
        />
        {choice === 'join' && (
          <Field
            label="Code du foyer"
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            placeholder="K7M2QX"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={[type.section, { letterSpacing: 6, height: 56 }]}
          />
        )}
        {error && (
          <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
        <PrimaryButton
          label={choice === 'create' ? 'Créer le foyer' : 'Rejoindre le foyer'}
          loading={busy}
          onPress={submit}
          style={{ marginTop: space.sm }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        style={{ marginTop: 'auto', alignSelf: 'center', paddingVertical: space.md, paddingHorizontal: space.lg }}>
        <AppText variant="label" color={colors.ink3}>
          Se déconnecter
        </AppText>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}
