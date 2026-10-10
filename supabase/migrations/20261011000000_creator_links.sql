-- Liens publics des créateurs (réseaux sociaux, site…), signés avec le reste du profil.
-- À coller dans Supabase > SQL Editor, ou `supabase db push` avec la CLI.

alter table public.creators
  add column links text[] not null default '{}'
  check (cardinality(links) <= 4);

-- La vue est recréée pour inclure links (c.* est figé à la création d'une vue).
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
