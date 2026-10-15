const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "09:42" */
export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

/** "Jeudi 15 octobre" */
export function formatToday(date = new Date()) {
  return capitalize(dayFmt.format(date));
}

/** "Aujourd'hui", "Hier", "Lundi 12 octobre" */
export function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return capitalize(dayFmt.format(d));
}

export function isSameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** "Bonjour" / "Bonsoir" */
export function greeting(date = new Date()) {
  return date.getHours() >= 18 ? 'Bonsoir' : 'Bonjour';
}
