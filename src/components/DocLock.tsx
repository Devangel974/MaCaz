import { Fingerprint, Lock } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDocuments } from '@/providers/DocumentsProvider';
import { colors, space } from '@/theme';

import { AppText, PrimaryButton } from './ui';

/** Écran « Papiers verrouillés » : rien n'est affiché tant que l'empreinte (ou le code) n'a pas été donnée. */
export function DocLock({ children, auto = true }: { children: ReactNode; auto?: boolean }) {
  const { unlocked, unlock } = useDocuments();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const asked = useRef(false);

  const ask = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const ok = await unlock();
      setFailed(!ok);
    } finally {
      setBusy(false);
    }
  };

  // On propose directement l'empreinte à l'ouverture (une seule fois).
  useEffect(() => {
    if (unlocked || !auto || asked.current) return;
    asked.current = true;
    unlock().then((ok) => {
      if (!ok) setFailed(true);
    });
  }, [unlocked, auto, unlock]);

  if (unlocked) return children;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.ground,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xl,
        paddingHorizontal: space.xxl,
        paddingTop: insets.top,
      }}>
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: 0, right: 0, width: 96, height: 96, borderRadius: 48, backgroundColor: colors.sun }} />
        <View style={{ position: 'absolute', bottom: 6, left: 4, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.coral }} />
        <View
          accessibilityRole="image"
          accessibilityLabel="Cadenas"
          style={{
            width: 112,
            height: 112,
            borderRadius: 36,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: '-6deg' }],
          }}>
          <Lock size={48} color={colors.lime} strokeWidth={2.4} />
        </View>
      </View>
      <View style={{ gap: space.sm, alignItems: 'center' }}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          Papiers verrouillés
        </AppText>
        <AppText color={colors.ink3} style={{ textAlign: 'center' }}>
          Passeports, cartes et assurances restent à l&apos;abri. Seuls vous deux y accédez.
        </AppText>
      </View>
      <View style={{ alignSelf: 'stretch', gap: space.md, alignItems: 'center' }}>
        <PrimaryButton label="Déverrouiller" icon={Fingerprint} loading={busy} onPress={ask} style={{ alignSelf: 'stretch' }} />
        <AppText variant="caption" color={failed ? colors.danger : colors.ink3} accessibilityLiveRegion="polite">
          {failed ? 'Pas reconnu, réessaie.' : 'Empreinte, visage ou code du téléphone'}
        </AppText>
      </View>
    </View>
  );
}
