-- Photos de profil des créateurs + contribution volontaire des fans à TipStreak.
-- À coller dans Supabase > SQL Editor, ou `supabase db push` avec la CLI.

-- ------------------------------------------------------------ photo de profil
-- URL publique de l'image dans Supabase Storage, écrite uniquement par l'Edge Function `upload-avatar`
-- après vérification d'une signature du wallet du créateur.
alter table public.creators
  add column avatar_url text check (avatar_url is null or avatar_url ~ '^https://');

-- Bucket public en lecture ; aucune policy d'écriture : seule l'Edge Function (clé secrète) y dépose des images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do nothing;

-- ------------------------------------------------- contribution volontaire
-- USDC versés en plus à TipStreak par le fan, dans la même transaction que le tip (lu on-chain par `record-tip`).
alter table public.tips
  add column contribution numeric(20, 6) not null default 0 check (contribution >= 0);

-- ------------------------------------------------------------------- stats
-- La vue est recréée pour inclure avatar_url (c.* est figé à la création d'une vue).
drop view public.creator_stats;
create view public.creator_stats with (security_invoker = true) as
select
  c.*,
  count(distinct t.fan_wallet)::int as supporters,
  coalesce(sum(t.amount), 0)        as total_received
from public.creators c
left join public.tips t on t.creator_id = c.id
group by c.id;

grant select on public.creator_stats to anon, authenticated;
