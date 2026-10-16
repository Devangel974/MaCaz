import { Check, Ellipsis, Plus, ShoppingBag, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { AppText, EmptyState, IconButton, SectionTitle } from '@/components/ui';
import type { ShoppingItem } from '@/lib/database.types';
import { CATEGORIES } from '@/lib/shopping';
import { errorMessage } from '@/lib/supabase';
import { useHousehold } from '@/providers/HouseholdProvider';
import { useShopping } from '@/providers/ShoppingProvider';
import { colors, radius, shadow, space, type } from '@/theme';

/** Pastille de couleur par rayon. */
const CATEGORY_COLOR: Record<string, string> = {
  'fruits-legumes': colors.lime,
  boucherie: colors.coral,
  cremerie: '#BDE3FF',
  boulangerie: colors.sunSoft,
  epicerie: colors.sun,
  surgeles: '#A7E8FF',
  boissons: colors.lagoon,
  hygiene: '#F5B8E4',
  maison: '#B9A8FF',
  autre: colors.mute,
};

const SUGGESTION_COLORS = [colors.sun, colors.lagoon, colors.coral];

type Section = { key: string; title: string; color: string; data: ShoppingItem[] };

function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 64;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${done} articles sur ${total} dans le panier`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.white} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.sun}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </Svg>
      <AppText variant="label" style={{ fontFamily: type.section.fontFamily, fontSize: 15 }}>
        {done}/{total}
      </AppText>
    </View>
  );
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { items, toBuy, inCart, suggestions, add, toggle, remove, clearCart, uncheckAll } = useShopping();
  const { memberById } = useHousehold();
  const [draft, setDraft] = useState('');

  const sections = useMemo<Section[]>(
    () =>
      CATEGORIES.map((c) => ({
        key: c.id,
        title: c.label,
        color: CATEGORY_COLOR[c.id] ?? colors.mute,
        data: toBuy.filter((i) => (CATEGORIES.some((x) => x.id === i.category) ? i.category : 'autre') === c.id),
      })).filter((s) => s.data.length > 0),
    [toBuy],
  );

  const allDone = items.length > 0 && toBuy.length === 0;

  const safe = (fn: () => Promise<void>) => () => fn().catch((e) => Alert.alert('Oups', errorMessage(e)));

  const submit = async (text = draft) => {
    if (!text.trim()) return;
    setDraft('');
    await safe(() => add(text))();
  };

  const openOptions = () =>
    Alert.alert('Liste de courses', undefined, [
      { text: 'Vider le panier', onPress: safe(clearCart) },
      { text: 'Tout décocher', onPress: safe(uncheckAll) },
      { text: 'Annuler', style: 'cancel' },
    ]);

  const confirmRemove = (item: ShoppingItem) =>
    Alert.alert(item.name, 'Supprimer cet article de la liste ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: safe(() => remove(item)) },
    ]);

  const subtitle =
    items.length === 0
      ? 'Rien pour le moment'
      : allDone
        ? 'Tout est dans le panier'
        : toBuy.length <= 3
          ? `Plus que ${toBuy.length}, on y est presque`
          : `Encore ${toBuy.length} articles à prendre`;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.ground }}>
      {/* En-tête */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.lg,
          paddingTop: insets.top + space.xl,
          paddingHorizontal: space.lg,
          paddingBottom: space.lg,
        }}>
        {items.length > 0 && <ProgressRing done={inCart.length} total={items.length} />}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title">Courses</AppText>
          <AppText variant="caption" color={colors.ink3}>
            {subtitle}
          </AppText>
        </View>
        <IconButton icon={Ellipsis} label="Options de la liste" onPress={openOptions} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, flexGrow: 1 }}
        ListHeaderComponent={
          allDone ? (
            <Animated.View
              entering={FadeInDown.springify()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.lg,
                marginBottom: space.lg,
                borderRadius: radius.card,
                backgroundColor: colors.accent,
                overflow: 'hidden',
              }}>
              <View
                pointerEvents="none"
                style={{ position: 'absolute', right: -24, top: -24, width: 96, height: 96, borderRadius: 48, backgroundColor: colors.sun }}
              />
              <Animated.View
                entering={ZoomIn.springify().delay(150)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  backgroundColor: colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ rotate: '-8deg' }],
                }}>
                <Sparkles size={24} color={colors.accent} strokeWidth={2.2} />
              </Animated.View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="section" color={colors.white}>
                  Bien joué !
                </AppText>
                <AppText variant="caption" color={colors.white}>
                  Tout est dans le panier.
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={safe(clearCart)}
                style={({ pressed }) => ({
                  height: 40,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.pill,
                  backgroundColor: colors.ink,
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <AppText variant="label" color={colors.white}>
                  Vider
                </AppText>
              </Pressable>
            </Animated.View>
          ) : null
        }
        ListEmptyComponent={
          allDone ? null : (
            <EmptyState
              icon={ShoppingBag}
              title="La liste est vide"
              description="Ajoute un article ci-dessous : il apparaît aussitôt sur l'autre téléphone."
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <SectionTitle dot={section.color} count={section.data.length} style={{ marginTop: space.lg, marginBottom: space.sm }}>
            {section.title}
          </SectionTitle>
        )}
        renderItem={({ item, index, section }) => (
          <Row
            item={item}
            first={index === 0}
            last={index === section.data.length - 1}
            adder={memberById(item.added_by)}
            onToggle={safe(() => toggle(item))}
            onLongPress={() => confirmRemove(item)}
          />
        )}
        ListFooterComponent={
          inCart.length > 0 ? (
            <View style={{ gap: space.sm, marginTop: space.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Check size={16} color={colors.white} strokeWidth={3} />
                </View>
                <AppText variant="overline">Dans le panier</AppText>
                <AppText variant="caption" color={colors.ink3}>
                  {inCart.length}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {inCart.map((i) => (
                  <Pressable
                    key={i.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel={`${i.name}, dans le panier. Toucher pour le remettre`}
                    onPress={safe(() => toggle(i))}
                    onLongPress={() => confirmRemove(i)}
                    style={({ pressed }) => ({
                      height: 36,
                      paddingHorizontal: 14,
                      borderRadius: 18,
                      backgroundColor: colors.line,
                      justifyContent: 'center',
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    })}>
                    <AppText variant="label" color={colors.ink3} style={{ textDecorationLine: 'line-through' }}>
                      {i.name}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {/* Ajout rapide, dans la zone du pouce */}
      <View style={{ gap: 10, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, backgroundColor: colors.ground }}>
        {suggestions.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="label" color={colors.ink3}>
              Souvent
            </AppText>
            {suggestions.map((s, i) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${s}`}
                onPress={() => submit(s)}
                style={({ pressed }) => ({
                  height: 32,
                  paddingHorizontal: space.md,
                  borderRadius: 16,
                  backgroundColor: SUGGESTION_COLORS[i % SUGGESTION_COLORS.length],
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}>
                <AppText variant="label">+ {s}</AppText>
              </Pressable>
            ))}
          </View>
        )}
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingVertical: 6,
              paddingRight: 6,
              paddingLeft: 18,
              borderRadius: 30,
              backgroundColor: colors.surface,
            },
            shadow.float,
          ]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit()}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder="Ajouter… (ex. 2 kg tomates)"
            placeholderTextColor={colors.ink3}
            accessibilityLabel="Ajouter un article"
            style={[type.body, { flex: 1, height: 48, color: colors.ink }]}
          />
          <IconButton icon={Plus} label="Ajouter" variant="primary" size={48} onPress={() => submit()} disabled={!draft.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({
  item,
  first,
  last,
  adder,
  onToggle,
  onLongPress,
}: {
  item: ShoppingItem;
  first: boolean;
  last: boolean;
  adder: ReturnType<ReturnType<typeof useHousehold>['memberById']>;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={`${item.name}${item.quantity ? `, ${item.quantity}` : ''}`}
      accessibilityHint="Appui long pour supprimer"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        minHeight: 56,
        paddingLeft: space.xs,
        paddingRight: space.md,
        backgroundColor: pressed ? '#FBFAFF' : colors.surface,
        borderTopWidth: first ? 0 : 1.5,
        borderStyle: 'dashed',
        borderTopColor: colors.lineSoft,
        borderTopLeftRadius: first ? radius.tile : 0,
        borderTopRightRadius: first ? radius.tile : 0,
        borderBottomLeftRadius: last ? radius.tile : 0,
        borderBottomRightRadius: last ? radius.tile : 0,
      })}>
      <View style={{ width: 48, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: colors.mute }} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm }}>
        <AppText variant="bodyStrong">{item.name}</AppText>
        {!!item.quantity && (
          <AppText variant="caption" color={colors.ink3}>
            {item.quantity}
          </AppText>
        )}
      </View>
      {adder && <Avatar member={adder} size={26} />}
    </Pressable>
  );
}
