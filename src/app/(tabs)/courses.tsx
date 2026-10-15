import { Check, ListFilter, Plus, ShoppingBag, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { AppText, EmptyState, IconButton, ProgressBar, SectionTitle } from '@/components/ui';
import type { ShoppingItem } from '@/lib/database.types';
import { CATEGORIES } from '@/lib/shopping';
import { errorMessage } from '@/lib/supabase';
import { useHousehold } from '@/providers/HouseholdProvider';
import { useShopping } from '@/providers/ShoppingProvider';
import { colors, radius, shadow, space, type } from '@/theme';

type Section = { key: string; title: string; data: ShoppingItem[]; done?: boolean };

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { items, toBuy, inCart, suggestions, add, toggle, remove, clearCart, uncheckAll } = useShopping();
  const { memberById } = useHousehold();
  const [draft, setDraft] = useState('');

  const sections = useMemo<Section[]>(() => {
    const groups: Section[] = CATEGORIES.map((c) => ({
      key: c.id,
      title: c.label,
      data: toBuy.filter((i) => (CATEGORIES.some((x) => x.id === i.category) ? i.category : 'autre') === c.id),
    })).filter((s) => s.data.length > 0);
    if (inCart.length) groups.push({ key: 'cart', title: `Dans le panier · ${inCart.length}`, data: inCart, done: true });
    return groups;
  }, [toBuy, inCart]);

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

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.ground }}>
      {/* En-tête */}
      <View style={{ gap: space.lg, paddingTop: insets.top + space.xl, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <AppText variant="title">Courses</AppText>
            <AppText variant="caption" color={colors.ink3}>
              {toBuy.length} à acheter · {inCart.length} dans le panier
            </AppText>
          </View>
          <IconButton icon={ListFilter} label="Options de la liste" onPress={openOptions} />
        </View>
        {items.length > 0 && <ProgressBar value={inCart.length / items.length} track={colors.line} />}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl, flexGrow: 1 }}
        ListHeaderComponent={
          allDone ? (
            <Animated.View
              entering={FadeInDown.springify()}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.lg,
                  marginBottom: space.lg,
                  borderRadius: radius.card,
                  backgroundColor: colors.surface,
                },
                shadow.card,
              ]}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Sparkles size={22} color={colors.accent} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Tout est dans le panier !</AppText>
                <AppText variant="caption" color={colors.ink3}>
                  Bien joué. On vide la liste ?
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={safe(clearCart)}
                style={({ pressed }) => ({
                  height: 40,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}>
                <AppText variant="label" color={colors.white}>
                  Vider
                </AppText>
              </Pressable>
            </Animated.View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={ShoppingBag}
            title="La liste est vide"
            description="Ajoute un article ci-dessous : il apparaît aussitôt sur l'autre téléphone."
          />
        }
        renderSectionHeader={({ section }) => (
          <SectionTitle style={{ marginTop: space.lg, marginBottom: space.xs }}>{section.title}</SectionTitle>
        )}
        renderItem={({ item, index, section }) => (
          <Row
            item={item}
            first={index === 0}
            last={index === section.data.length - 1}
            done={!!section.done}
            adder={memberById(item.added_by)}
            onToggle={safe(() => toggle(item))}
            onLongPress={() => confirmRemove(item)}
          />
        )}
      />

      {/* Ajout rapide, dans la zone du pouce */}
      <View
        style={{
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          backgroundColor: colors.ground,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}>
        {suggestions.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="caption" color={colors.ink3}>
              Souvent :
            </AppText>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${s}`}
                onPress={() => submit(s)}
                style={({ pressed }) => ({
                  height: 32,
                  paddingHorizontal: space.md,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface,
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}>
                <AppText variant="caption">+ {s}</AppText>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit()}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder="Ajouter un article… (ex. 2 kg tomates)"
            placeholderTextColor={colors.ink3}
            accessibilityLabel="Ajouter un article"
            style={[
              type.body,
              {
                flex: 1,
                height: 48,
                paddingHorizontal: space.lg,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 24,
                backgroundColor: colors.surface,
                color: colors.ink,
              },
            ]}
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
  done,
  adder,
  onToggle,
  onLongPress,
}: {
  item: ShoppingItem;
  first: boolean;
  last: boolean;
  done: boolean;
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
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          minHeight: 52,
          paddingLeft: space.xs,
          paddingRight: space.md,
          backgroundColor: pressed ? '#FAFBF9' : colors.surface,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: colors.lineSoft,
          borderTopLeftRadius: first ? radius.card : 0,
          borderTopRightRadius: first ? radius.card : 0,
          borderBottomLeftRadius: last ? radius.card : 0,
          borderBottomRightRadius: last ? radius.card : 0,
          opacity: done ? 0.8 : 1,
        },
        first && last ? shadow.card : null,
      ]}>
      <View style={{ width: 44, height: 52, alignItems: 'center', justifyContent: 'center' }}>
        {item.checked ? (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Check size={14} color={colors.white} strokeWidth={3} />
          </View>
        ) : (
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.mute }} />
        )}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm }}>
        <AppText
          color={done ? colors.ink3 : colors.ink}
          style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {item.name}
        </AppText>
        {!!item.quantity && (
          <AppText variant="caption" color={colors.ink3}>
            {item.quantity}
          </AppText>
        )}
      </View>
      {!done && adder && <Avatar member={adder} size={24} tone="soft" />}
    </Pressable>
  );
}
