// Calcul des streaks à partir de l'historique réel des tips.
// Une semaine va du lundi 00:00 au dimanche 23:59, heure du téléphone.

export type SupportRelation = {
  creatorId: string;
  weeklyCount: number; // tips envoyés à ce créateur cette semaine
  consecutiveWeeks: number; // semaines consécutives avec au moins 1 tip
  totalTipped: number; // total en USDC depuis le début
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Début (lundi 00:00 local) de la semaine contenant `date`
export function weekStart(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // getDay() : 0 = dimanche
  return d.getTime();
}

// Numéro de semaine relatif (0 = semaine courante, 1 = la précédente…).
// Arrondi : les changements d'heure été/hiver décalent d'une heure.
function weeksAgo(date: Date, currentWeekStart: number): number {
  return Math.round((currentWeekStart - weekStart(date)) / WEEK_MS);
}

export function computeSupport(
  tips: { creator_id: string; amount: number; created_at: string }[],
  now = new Date()
): SupportRelation[] {
  const currentWeek = weekStart(now);
  const byCreator = new Map<string, { weeks: Set<number>; weeklyCount: number; total: number }>();

  for (const tip of tips) {
    const entry = byCreator.get(tip.creator_id) ?? { weeks: new Set<number>(), weeklyCount: 0, total: 0 };
    const ago = weeksAgo(new Date(tip.created_at), currentWeek);
    entry.weeks.add(ago);
    if (ago === 0) entry.weeklyCount++;
    entry.total += tip.amount;
    byCreator.set(tip.creator_id, entry);
  }

  return [...byCreator].map(([creatorId, { weeks, weeklyCount, total }]) => {
    // La semaine en cours n'est pas finie : un streak reste vivant si la semaine dernière compte
    let week = weeks.has(0) ? 0 : 1;
    let consecutiveWeeks = 0;
    while (weeks.has(week)) {
      consecutiveWeeks++;
      week++;
    }
    return { creatorId, weeklyCount, consecutiveWeeks, totalTipped: Math.round(total * 100) / 100 };
  });
}
