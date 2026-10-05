import type { TextStyle } from 'react-native';

// Identité TipStreak : le violet et le vert de Solana, croisés avec le cyan et la typo
// monospace "technique" de l'univers Solana Mobile / Seeker. Fond sombre légèrement bleuté.
//   violet  → la marque, les boutons (Solana)
//   cyan    → les séries / streaks, l'élément actif (Seeker)
//   vert    → l'argent qui arrive : montants USDC, succès (Solana)
//   or      → l'exceptionnel : boost, Légende
export const colors = {
  bg: '#08070E',
  bg2: '#0C0B16',
  surface: '#121124',
  surface2: '#1A1830',
  border: '#272544',
  borderSoft: '#1E1C36',
  text: '#F2F0FA',
  textDim: '#9893B5',
  textFaint: '#615D7F',
  purple: '#9945FF',
  cyan: '#19E3D0',
  green: '#14F195',
  gold: '#FFB84D',
};

// Dégradé de marque : violet Solana → cyan Seeker (boutons, logo, barres de série)
export const gradient = [colors.purple, '#5D6BFF', colors.cyan] as const;
export const gradientStreak = [colors.cyan, colors.purple] as const; // vertical : bas → haut

export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  // Monospace façon Seeker : chiffres, montants, handles, étiquettes
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

// Étiquette de section en capitales monospace (ex. "TENDANCES CETTE SEMAINE")
export const sectionLabel: TextStyle = {
  color: colors.textFaint,
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  marginBottom: 10,
};

// Couleur d'avatar stable par créateur, tirée de la palette
const AVATAR_PAIRS: [string, string][] = [
  ['#9945FF', '#5D6BFF'],
  ['#5D6BFF', '#19E3D0'],
  ['#19E3D0', '#14F195'],
  ['#C74BFF', '#9945FF'],
  ['#14F195', '#19E3D0'],
  ['#FFB84D', '#FF6FA8'],
];

export function avatarColors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PAIRS[hash % AVATAR_PAIRS.length];
}

// --- Tier logic ---
// weeklyCount = tips sent to this creator during the current week
// consecutiveWeeks = number of consecutive weeks with at least 1 tip to this creator
export type Tier = 'supporter' | 'fanActif';

export const FAN_ACTIF_WEEKLY_TIPS = 3;
export const LEGEND_WEEKS = 8;

export function getWeeklyTier(weeklyCount: number): Tier {
  return weeklyCount >= FAN_ACTIF_WEEKLY_TIPS ? 'fanActif' : 'supporter';
}

export function isLegend(consecutiveWeeks: number): boolean {
  return consecutiveWeeks >= LEGEND_WEEKS;
}
// Libellés des badges : voir src/i18n/translations.ts (tier.*)
