// Liens publics d'un créateur (réseaux sociaux, site…). Mêmes règles que l'Edge Function register-creator.
export const MAX_LINKS = 4;
const MAX_LINK_LENGTH = 200;
const VALID_LINK = /^https:\/\/[^\s/$.?#][^\s]*$/i;

// "x.com/neo" → "https://x.com/neo" ; renvoie null si ce n'est pas un lien https valable
export function normalizeLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:\/\//i, 'https://') : `https://${trimmed}`;
  return withScheme.length <= MAX_LINK_LENGTH && VALID_LINK.test(withScheme) ? withScheme : null;
}

const PLATFORMS: { hosts: string[]; label: string; icon: string }[] = [
  { hosts: ['x.com', 'twitter.com'], label: 'X', icon: '𝕏' },
  { hosts: ['youtube.com', 'youtu.be'], label: 'YouTube', icon: '▶️' },
  { hosts: ['instagram.com'], label: 'Instagram', icon: '📸' },
  { hosts: ['tiktok.com'], label: 'TikTok', icon: '🎵' },
  { hosts: ['twitch.tv'], label: 'Twitch', icon: '🎮' },
  { hosts: ['discord.gg', 'discord.com'], label: 'Discord', icon: '💬' },
  { hosts: ['github.com'], label: 'GitHub', icon: '💻' },
  { hosts: ['soundcloud.com'], label: 'SoundCloud', icon: '🎧' },
  { hosts: ['open.spotify.com', 'spotify.com'], label: 'Spotify', icon: '🎧' },
  { hosts: ['linkedin.com'], label: 'LinkedIn', icon: '💼' },
  { hosts: ['t.me', 'telegram.me'], label: 'Telegram', icon: '✈️' },
];

// Nom et icône affichés pour un lien ; à défaut, le nom de domaine
export function describeLink(url: string): { label: string; icon: string } {
  const host = (url.match(/^https:\/\/([^/?#]+)/i)?.[1] ?? '').toLowerCase().replace(/^www\.|^m\./, '');
  const platform = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return platform ? { label: platform.label, icon: platform.icon } : { label: host || url, icon: '🌐' };
}
