import { House } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, Field, PrimaryButton, SecondaryButton } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, shadow, space } from '@/theme';

type Mode = 'signin' | 'signup';

export default function ConnexionScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Renseigne un email valide et un mot de passe de 6 caractères minimum.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const needsConfirmation = await signUp(email, password);
        if (needsConfirmation) {
          setInfo('Compte créé. Ouvre le lien reçu par email, puis connecte-toi.');
          setMode('signin');
        }
      }
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
      <View style={{ gap: space.xl }}>
        <View
          accessibilityLabel="Logo MaCaz"
          style={[
            {
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            },
            shadow.primary,
          ]}>
          <House size={34} color={colors.white} strokeWidth={1.8} />
        </View>
        <View style={{ gap: space.sm }}>
          <AppText variant="title">MaCaz</AppText>
          <AppText color={colors.ink2}>
            Nos courses, nos messages, notre agenda et nos papiers. Juste nous deux.
          </AppText>
        </View>
      </View>

      <View style={{ gap: space.lg }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="prenom@exemple.fr"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error && (
          <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
        {info && (
          <AppText variant="caption" color={colors.okFg} accessibilityLiveRegion="polite">
            {info}
          </AppText>
        )}
        <PrimaryButton
          label={mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          loading={busy}
          onPress={submit}
          style={{ marginTop: space.sm }}
        />
      </View>

      <Card style={{ marginTop: 'auto', gap: space.md }}>
        <AppText variant="bodyStrong">{mode === 'signin' ? 'Première fois ?' : 'Déjà un compte ?'}</AppText>
        <AppText variant="caption" color={colors.ink3}>
          {mode === 'signin'
            ? 'Crée ton compte, puis crée le foyer ou rejoins-le avec le code à 6 caractères de ta moitié.'
            : 'Connecte-toi avec ton email et ton mot de passe.'}
        </AppText>
        <SecondaryButton
          label={mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
        />
      </Card>
    </KeyboardAwareScrollView>
  );
}
