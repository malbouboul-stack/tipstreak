import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';

// Liens profonds via le scheme personnalisé (déclaré dans app.json) :
//   tipstreak://            → Découvrir
//   tipstreak://mika        → profil de Mika (l'écran retrouve le créateur par son handle)
//   tipstreak://historique  → onglet Historique
// Les chemins des onglets sont statiques, donc prioritaires sur ":handle" :
// "soutiens", "historique" et "profil" sont refusés comme handle par la base (cf. migration).
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['tipstreak://'],
  config: {
    initialRouteName: 'Tabs', // garde les onglets sous le profil pour que "retour" fonctionne après un lien
    screens: {
      Tabs: {
        screens: {
          Discover: '',
          Support: 'soutiens',
          History: 'historique',
          CreatorSetup: 'profil',
        },
      },
      CreatorProfile: ':handle',
    },
  },
};
