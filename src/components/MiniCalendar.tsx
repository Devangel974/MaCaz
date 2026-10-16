import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { addDays, monthTitle, sameDay, startOfDay, startOfWeek } from '@/lib/calendar';
import { colors, space } from '@/theme';

import { AppText, IconButton } from './ui';

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Petit calendrier mensuel en JS pur (pas de module natif à reconstruire). */
export function MiniCalendar({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const today = startOfDay(new Date());
  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Une 6e ligne entièrement hors du mois est masquée.
  const rows = days[35].getMonth() !== month.getMonth() ? 5 : 6;

  return (
    <View style={{ gap: space.sm, padding: space.md, borderRadius: 24, backgroundColor: colors.ground }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="section" style={{ flex: 1, paddingLeft: space.xs }}>
          {monthTitle(month)}
        </AppText>
        <IconButton
          icon={ChevronLeft}
          label="Mois précédent"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        />
        <IconButton
          icon={ChevronRight}
          label="Mois suivant"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          style={{ marginLeft: space.xs }}
        />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {DOW.map((d, i) => (
          <AppText key={i} variant="label" color={colors.ink3} style={{ flex: 1, textAlign: 'center' }}>
            {d}
          </AppText>
        ))}
      </View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {days.slice(r * 7, r * 7 + 7).map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const sel = sameDay(d, value);
            const isToday = sameDay(d, today);
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={dayFmt.format(d)}
                onPress={() => onChange(d)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: sel ? colors.accent : 'transparent',
                    borderWidth: isToday && !sel ? 2 : 0,
                    borderColor: colors.accent,
                  }}>
                  <AppText
                    variant={sel ? 'bodyStrong' : 'body'}
                    color={sel ? colors.white : inMonth ? colors.ink : colors.mute}>
                    {d.getDate()}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
