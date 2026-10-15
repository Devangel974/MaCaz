import { CalendarDays } from 'lucide-react-native';

import { ComingSoon } from '@/components/ComingSoon';

export default function AgendaScreen() {
  return (
    <ComingSoon
      title="Agenda"
      icon={CalendarDays}
      headline="L'agenda partagé arrive bientôt"
      description="C'est la prochaine étape, juste après la liste de courses et le chat."
      features={[
        'Semaine en un coup d’œil, avec les jours chargés repérés',
        'Événements colorés : toi, ta moitié ou ensemble',
        'Rappels de renouvellement ajoutés depuis Documents',
      ]}
    />
  );
}
