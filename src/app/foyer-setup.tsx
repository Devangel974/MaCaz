import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BrandHero } from '@/components/BrandHero';
import { AppText, Field, PrimaryButton } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, space, type } from '@/theme';

type Choice = 'create' | 'join';

export default function FoyerSetupScreen() {
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
    <BrandHero
      title="Votre caz"
      subtitle="Le premier crée la caz et reçoit un code. L'autre la rejoint avec ce code.">
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          gap: space.xs,
          padding: space.xs,
          borderRadius: 22,
          backgroundColor: colors.ground,
        }}>
        {(
          [
            ['create', 'Créer notre caz'],
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
                height: 48,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? (id === 'create' ? colors.sun : colors.lagoon) : 'transparent',
              }}>
              <AppText variant="label" color={selected ? colors.ink : colors.ink3}>
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
            label="Code de la caz"
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
          <AppText variant="label" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
        <PrimaryButton
          tone="ink"
          label={choice === 'create' ? 'Créer la caz' : 'Rejoindre la caz'}
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
    </BrandHero>
  );
}
