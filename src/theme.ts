export const colors = {
  bg: '#0A0712',
  bg2: '#0E0A18',
  surface: '#150F22',
  surface2: '#1C1530',
  border: '#2A2140',
  borderSoft: '#221A34',
  text: '#F3EFFA',
  textDim: '#9089AD',
  textFaint: '#5F5878',
  purple: '#9945FF',
  green: '#14F195',
  gold: '#FFB84D',
};

export const gradient = [colors.purple, '#6C4DFF', colors.green] as const;
export const gradientSoft = 'linear-gradient(120deg, rgba(153,69,255,0.18), rgba(20,241,149,0.18))';

export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

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

export const tierLabel: Record<Tier, string> = {
  supporter: 'Supporter',
  fanActif: 'Fan actif',
};
