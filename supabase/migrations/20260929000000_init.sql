-- TipStreak : schéma initial (créateurs + tips)
-- À coller dans Supabase > SQL Editor, ou `supabase db push` avec la CLI.
--
-- Principe de sécurité : l'app (clé publishable = rôle anon) peut seulement LIRE.
-- Les tips sont écrits uniquement par l'Edge Function `record-tip`, qui vérifie
-- d'abord la transaction sur Solana devnet. Personne ne peut inventer un tip.

-- ---------------------------------------------------------------- créateurs
create table public.creators (
  id             uuid primary key default gen_random_uuid(),
  -- slug public du lien profond tipstreak://<handle>
  -- (soutiens / historique / profil sont déjà pris par les onglets de l'app)
  handle         text not null unique
                 check (handle ~ '^[a-z0-9_]{3,30}$'
                        and handle not in ('soutiens', 'historique', 'profil')),
  name           text not null check (char_length(name) between 1 and 50),
  category       text not null check (char_length(category) between 1 and 50),
  bio            text not null default '' check (char_length(bio) <= 280),
  wallet_address text not null unique, -- adresse Solana (base58) qui reçoit les USDC
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------- tips
create table public.tips (
  signature       text primary key,          -- signature de la transaction USDC : empêche de compter 2 fois le même tip
  fan_wallet      text not null,             -- signataire de la transaction
  creator_id      uuid not null references public.creators (id) on delete cascade,
  amount          numeric(20, 6) not null check (amount > 0), -- en USDC, lu on-chain
  boosted         boolean not null default false,
  boost_signature text unique,               -- transaction TSKR ; unique = un boost ne sert qu'une fois
  message         text check (char_length(message) <= 280), -- lu dans le memo de la transaction
  created_at      timestamptz not null,      -- heure du bloc Solana, pas l'heure du téléphone
  check (boosted = (boost_signature is not null))
);

create index tips_creator_created_idx on public.tips (creator_id, created_at desc);
create index tips_fan_created_idx on public.tips (fan_wallet, created_at desc);

-- ---------------------------------------------------------------- sécurité
alter table public.creators enable row level security;
alter table public.tips enable row level security;

-- Activer RLS ne retire pas les droits par défaut de Supabase : on repart de zéro.
revoke all on public.creators, public.tips from anon, authenticated;
grant select on public.creators, public.tips to anon, authenticated;

create policy "Créateurs visibles par tous"
  on public.creators for select to anon, authenticated using (true);

create policy "Tips visibles par tous"
  on public.tips for select to anon, authenticated using (true);

-- Aucune policy insert/update/delete : seule l'Edge Function (clé secrète) écrit.

-- ------------------------------------------------------------------- stats
-- Remplace le champ `supporters` codé en dur de mockData.ts.
create view public.creator_stats with (security_invoker = true) as
select
  c.*,
  count(distinct t.fan_wallet)::int as supporters,
  coalesce(sum(t.amount), 0)        as total_received
from public.creators c
left join public.tips t on t.creator_id = c.id
group by c.id;

grant select on public.creator_stats to anon, authenticated;
