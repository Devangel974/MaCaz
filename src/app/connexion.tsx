import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { BrandHero } from '@/components/BrandHero';
import { AppText, Field, PrimaryButton, SecondaryButton } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

type Mode = 'signin' | 'signup';

export default function ConnexionScreen() {
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
    <BrandHero title="MaCaz" subtitle="Courses, messages, agenda et papiers. Juste nous deux.">
      <View style={{ gap: 14 }}>
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
          <AppText variant="label" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
        {info && (
          <AppText variant="label" color={colors.okFg} accessibilityLiveRegion="polite">
            {info}
          </AppText>
        )}
        <PrimaryButton
          tone="ink"
          icon={ArrowRight}
          label={mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          loading={busy}
          onPress={submit}
          style={{ marginTop: 6 }}
        />
      </View>

      <View style={{ marginTop: 'auto', gap: 10, paddingTop: space.lg }}>
        <AppText variant="label" color={colors.ink3} style={{ textAlign: 'center' }}>
          {mode === 'signin' ? 'Première fois ?' : 'Déjà un compte ?'}
        </AppText>
        <SecondaryButton
          bg={colors.sun}
          label={mode === 'signin' ? 'Créer un compte' : 'Se connecter'}
          onPress={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
        />
        {mode === 'signin' && (
          <AppText variant="caption" color={colors.ink3} style={{ textAlign: 'center' }}>
            Ensuite : crée votre caz, ou rejoins-la avec le code de ta moitié.
          </AppText>
        )}
      </View>
    </BrandHero>
  );
}
