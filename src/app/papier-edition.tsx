import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, FileText, FileUp, Images, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CAZ_COLOR } from '@/components/DocBits';
import { DocLock } from '@/components/DocLock';
import { AppText, Field, IconButton, PrimaryButton } from '@/components/ui';
import type { DocType, HouseDocument } from '@/lib/database.types';
import {
  compressPhoto,
  DOC_TYPES,
  type Draft,
  type DraftPage,
  formatSize,
  parseDate,
  REMIND_OPTIONS,
  toDateString,
} from '@/lib/documents';
import { errorMessage } from '@/lib/supabase';
import { useDocuments } from '@/providers/DocumentsProvider';
import { useHousehold } from '@/providers/HouseholdProvider';
import { colors, personColors, radius, space, type } from '@/theme';

const MAX_PAGES = 12;
const MAX_PDF_BYTES = 50 * 1024 * 1024;

type Owner = 'me' | 'partner' | 'caz';

type FormState = {
  title: string;
  docType: DocType;
  owner: Owner;
  noDate: boolean;
  date: string; // "jj/mm/aaaa" tel que saisi
  remind: number[];
  agenda: boolean;
  notes: string;
};

function toFrDate(iso: string | null) {
  const d = parseDate(iso);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "02/03/2027" → "2027-03-02" (ou null si invalide). */
function fromFrDate(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [j, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(y, mo - 1, j);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== j || y < 1990 || y > 2100) return null;
  return toDateString(d);
}

/** Ajoute les « / » au fil de la saisie. */
function maskDate(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

export default function PapierEditionScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { byId, loading } = useDocuments();
  const insets = useSafeAreaInsets();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const existing = byId(id);

  return (
    <DocLock>
      {id && !existing ? (
        <View style={{ flex: 1, backgroundColor: colors.surface, padding: space.xl, paddingTop: insets.top + space.xl, gap: space.lg }}>
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <AppText variant="title">Papier introuvable</AppText>
              <PrimaryButton label="Fermer" tone="ink" onPress={() => router.back()} />
            </>
          )}
        </View>
      ) : (
        <PapierForm key={existing?.id ?? 'nouveau'} existing={existing} />
      )}
    </DocLock>
  );
}

function Label({ children }: { children: string }) {
  return <AppText variant="overline">{children}</AppText>;
}

function Pill({
  label,
  active,
  onPress,
  bg = colors.ink,
  fg = colors.white,
  role = 'radio',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  bg?: string;
  fg?: string;
  role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 20,
        justifyContent: 'center',
        backgroundColor: active ? bg : colors.ground,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}>
      <AppText variant="label" color={active ? fg : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

function SourceButton({ icon: Icon, label, onPress, bg }: { icon: typeof Camera; label: string; onPress: () => void; bg: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: bg,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}>
      <Icon size={18} color={colors.ink} strokeWidth={2.2} />
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

function PapierForm({ existing }: { existing: HouseDocument | null }) {
  const insets = useSafeAreaInsets();
  const { save, keepUnlocked } = useDocuments();
  const { me, partner } = useHousehold();
  const editing = !!existing;

  const [f, setF] = useState<FormState>(() => ({
    title: existing?.title ?? 'Passeport',
    docType: existing?.doc_type ?? 'passeport',
    owner: !existing
      ? 'me'
      : existing.owner_user === null
        ? 'caz'
        : existing.owner_user === me?.user_id
          ? 'me'
          : 'partner',
    noDate: existing ? !existing.expires_at : false,
    date: toFrDate(existing?.expires_at ?? null),
    remind: existing?.remind_days ?? [180, 30, 0],
    agenda: existing ? !!existing.agenda_event_id : true,
    notes: existing?.notes ?? '',
  }));
  const [draft, setDraft] = useState<Draft>({ kind: 'none' });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const pages = draft.kind === 'images' ? draft.pages : [];

  const pickType = (t: DocType) => {
    const prevDefault = DOC_TYPES.find((d) => d.id === f.docType)?.defaultTitle ?? '';
    const nextDefault = DOC_TYPES.find((d) => d.id === t)?.defaultTitle ?? '';
    setF((p) => ({
      ...p,
      docType: t,
      // On ne remplace le nom que s'il n'a pas été personnalisé.
      title: !p.title.trim() || p.title === prevDefault ? nextDefault : p.title,
      noDate: t === 'vitale' ? true : p.noDate,
    }));
  };

  const addPages = async (assets: { uri: string; width: number; height: number }[]) => {
    if (!assets.length) return;
    setAdding(true);
    try {
      const room = MAX_PAGES - pages.length;
      const compressed: DraftPage[] = [];
      for (const a of assets.slice(0, room)) compressed.push(await compressPhoto(a));
      setDraft((d) => ({ kind: 'images', pages: [...(d.kind === 'images' ? d.pages : []), ...compressed] }));
      if (assets.length > room) Alert.alert('Maximum atteint', `Un papier peut contenir ${MAX_PAGES} pages.`);
    } catch (e) {
      Alert.alert('Oups', errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Appareil photo', 'Autorise l’appareil photo dans les réglages du téléphone pour photographier tes papiers.');
      return;
    }
    const res = await keepUnlocked(() => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
    if (!res.canceled) await addPages(res.assets);
  };

  const fromGallery = async () => {
    const res = await keepUnlocked(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: Math.max(1, MAX_PAGES - pages.length),
        quality: 1,
      }),
    );
    if (!res.canceled) await addPages(res.assets);
  };

  const importPdf = async () => {
    const res = await keepUnlocked(() =>
      DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false }),
    );
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_PDF_BYTES) {
      Alert.alert('Fichier trop lourd', 'Le PDF dépasse 50 Mo.');
      return;
    }
    setDraft({ kind: 'pdf', file: { uri: a.uri, name: a.name } });
  };

  const removePage = (i: number) =>
    setDraft((d) => {
      if (d.kind !== 'images') return d;
      const next = d.pages.filter((_, j) => j !== i);
      return next.length ? { kind: 'images', pages: next } : { kind: 'none' };
    });

  const toggleRemind = (days: number) =>
    setF((p) => ({ ...p, remind: p.remind.includes(days) ? p.remind.filter((d) => d !== days) : [...p.remind, days] }));

  const submit = async () => {
    setError(null);
    const title = f.title.trim();
    if (!title) return setError('Donne un nom au papier.');
    if (!existing && draft.kind === 'none') return setError('Ajoute au moins une photo ou un PDF.');
    const expires = f.noDate ? null : fromFrDate(f.date);
    if (!f.noDate && !expires) return setError('Date d’expiration invalide (jj/mm/aaaa), ou choisis « Sans date ».');

    setBusy(true);
    try {
      const doc = await save(
        {
          title,
          doc_type: f.docType,
          owner_user: f.owner === 'caz' ? null : f.owner === 'me' ? (me?.user_id ?? null) : (partner?.user_id ?? null),
          expires_at: expires,
          remind_days: expires ? f.remind : [],
          notes: f.notes.trim() || null,
          addToAgenda: !!expires && f.agenda,
        },
        draft,
        existing,
      );
      if (existing) router.back();
      else router.replace({ pathname: '/papier', params: { id: doc.id } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const ownerOptions: { label: string; value: Owner; bg: string; fg: string }[] = [
    ...(me ? [{ label: me.display_name, value: 'me' as const, bg: personColors[me.color].solid, fg: colors.ink }] : []),
    ...(partner
      ? [{ label: partner.display_name, value: 'partner' as const, bg: personColors[partner.color].solid, fg: colors.ink }]
      : []),
    { label: 'La caz', value: 'caz', bg: CAZ_COLOR, fg: colors.ink },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
        }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {editing ? 'Modifier' : 'Nouveau papier'}
        </AppText>
        <IconButton icon={X} label="Fermer" variant="tint" onPress={() => router.back()} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={space.xl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 130, gap: space.xl }}>
        {/* Pages */}
        <View style={{ gap: space.md }}>
          <Label>Les pages</Label>
          {draft.kind === 'pdf' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.field, backgroundColor: colors.ground }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color={colors.ink} />
              </View>
              <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                {draft.file.name}
              </AppText>
              <IconButton icon={X} label="Retirer le PDF" variant="plain" onPress={() => setDraft({ kind: 'none' })} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
              {pages.map((p, i) => (
                <View key={p.uri} accessibilityLabel={`Page ${i + 1}`}>
                  <Image source={{ uri: p.uri }} style={{ width: 96, height: 128, borderRadius: 16, backgroundColor: colors.ground }} contentFit="cover" />
                  <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.ink }}>
                    <AppText variant="label" color={colors.white}>
                      {i === 0 ? 'Recto' : i === 1 ? 'Verso' : `Page ${i + 1}`}
                    </AppText>
                  </View>
                  <IconButton
                    icon={X}
                    label={`Retirer la page ${i + 1}`}
                    size={28}
                    onPress={() => removePage(i)}
                    style={{ position: 'absolute', top: 4, right: 4 }}
                  />
                </View>
              ))}
              {pages.length < MAX_PAGES && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Prendre une photo"
                  onPress={takePhoto}
                  disabled={adding}
                  style={({ pressed }) => ({
                    width: 96,
                    height: 128,
                    borderRadius: 16,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}>
                  {adding ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Camera size={26} color={colors.white} strokeWidth={2.2} />
                      <AppText variant="label" color={colors.white}>
                        Photo
                      </AppText>
                    </>
                  )}
                </Pressable>
              )}
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <SourceButton icon={Images} label="Depuis la galerie" onPress={fromGallery} bg={colors.sun} />
            <SourceButton icon={FileUp} label="Importer un PDF" onPress={importPdf} bg={colors.lagoon} />
          </View>
          <AppText variant="caption" color={colors.ink3}>
            {existing?.file_path && draft.kind === 'none'
              ? `Fichier actuel conservé${existing.page_count ? ` (${existing.page_count} page${existing.page_count > 1 ? 's' : ''}${existing.size_bytes ? `, ${formatSize(existing.size_bytes)}` : ''})` : ''}. Ajoute des pages pour le remplacer.`
              : 'Les photos seront réunies en un seul PDF.'}
          </AppText>
        </View>

        {/* Type */}
        <View style={{ gap: space.md }}>
          <Label>C&apos;est quoi ?</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {DOC_TYPES.map((t) => (
              <Pill key={t.id} label={t.label} active={f.docType === t.id} onPress={() => pickType(t.id)} />
            ))}
          </View>
        </View>

        <Field label="Nom" value={f.title} onChangeText={(t) => set('title', t)} placeholder="Ex. Mutuelle santé" maxLength={80} />

        {/* Propriétaire */}
        <View style={{ gap: space.md }}>
          <Label>À qui ?</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {ownerOptions.map((o) => (
              <Pill key={o.value} label={o.label} active={f.owner === o.value} onPress={() => set('owner', o.value)} bg={o.bg} fg={o.fg} />
            ))}
          </View>
        </View>

        {/* Expiration */}
        <View style={{ gap: space.md }}>
          <Label>Expire le</Label>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <TextInput
              accessibilityLabel="Date d'expiration"
              value={f.noDate ? '' : f.date}
              editable={!f.noDate}
              onChangeText={(t) => set('date', maskDate(t))}
              placeholder={f.noDate ? 'Sans date' : 'jj/mm/aaaa'}
              placeholderTextColor={colors.ink3}
              keyboardType="number-pad"
              maxLength={10}
              style={[
                type.body,
                {
                  flex: 1,
                  height: 54,
                  paddingHorizontal: 18,
                  borderRadius: radius.field,
                  backgroundColor: colors.ground,
                  color: colors.ink,
                  opacity: f.noDate ? 0.6 : 1,
                },
              ]}
            />
            <Pill label="Sans date" role="checkbox" active={f.noDate} onPress={() => set('noDate', !f.noDate)} />
          </View>
        </View>

        {!f.noDate && (
          <>
            <View style={{ gap: space.md }}>
              <Label>Me prévenir</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {REMIND_OPTIONS.map((o) => (
                  <Pill
                    key={o.days}
                    role="checkbox"
                    label={o.label}
                    active={f.remind.includes(o.days)}
                    onPress={() => toggleRemind(o.days)}
                    bg={colors.sun}
                    fg={colors.ink}
                  />
                ))}
              </View>
              <AppText variant="caption" color={colors.ink3}>
                Notification sur vos deux téléphones, et une carte dans le chat.
              </AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="overline">Ajouter à l&apos;agenda</AppText>
                <AppText variant="caption" color={colors.ink3}>
                  « Renouveler : {f.title.trim() || 'papier'} », au premier rappel
                </AppText>
              </View>
              <Switch
                accessibilityLabel="Ajouter à l'agenda"
                value={f.agenda}
                onValueChange={(v) => set('agenda', v)}
                trackColor={{ true: colors.accent, false: colors.mute }}
                thumbColor={colors.white}
              />
            </View>
          </>
        )}

        <Field
          label="Notes (facultatif)"
          value={f.notes}
          onChangeText={(t) => set('notes', t)}
          placeholder="Ex. Original dans la pochette bleue"
          maxLength={1000}
          multiline
          style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }}
        />
      </KeyboardAwareScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.lg,
          backgroundColor: colors.surface,
        }}>
        {error && (
          <AppText variant="label" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        )}
        <PrimaryButton
          label={busy ? 'Envoi en cours…' : draft.kind === 'images' ? 'Créer le PDF et enregistrer' : 'Enregistrer'}
          loading={busy}
          disabled={adding}
          onPress={submit}
        />
      </View>
    </View>
  );
}
