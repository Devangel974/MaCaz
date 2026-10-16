import { FileText } from 'lucide-react-native';

import { ComingSoon } from '@/components/ComingSoon';
import { colors } from '@/theme';

export default function DocumentsScreen() {
  return (
    <ComingSoon
      title="Documents"
      tint={colors.coral}
      icon={FileText}
      headline="Le coffre à papiers arrive bientôt"
      description="Passeports, cartes d'identité, assurances : rangés, chiffrés et suivis."
      features={[
        'Scan compressé et chiffré sur le téléphone avant envoi',
        'Accès protégé par empreinte digitale',
        'Alerte avant expiration (ex. passeport à 6 mois)',
      ]}
    />
  );
}
