-- Les 4 créateurs de démo de src/data/mockData.ts.
-- Pas de tips ici : un tip n'existe que s'il correspond à une vraie transaction
-- devnet, il passe donc obligatoirement par l'Edge Function record-tip.
insert into public.creators (handle, name, category, bio, wallet_address) values
  ('mika', 'Mika Beats', 'Musique · Producteur',
   'Je fais des beats lo-fi depuis mon studio à Lyon. Chaque tip m''aide à sortir un nouveau morceau par mois.',
   '3mDtxo9mx8py7Qnv12WoSjYBGsmYuh5D2ASkzhci3z8C'),
  ('devrayan', 'DevRayan', 'Dev · Apps Solana',
   'Je construis des outils open-source pour l''écosystème Solana Mobile.',
   '8JHcwZ9hexfuvHRRKoB2FJtSKZJvM8nYVxqi9xZq6bL1'),
  ('linaart', 'Lina Art', 'Illustration',
   'Illustratrice indépendante, une planche par semaine.',
   '666UHgAcW2SWGhb8KwwKGVjxKyrkZ7miM1NySVxNmFGy'),
  ('nadia', 'Nadia Streams', 'Gaming',
   'Streams gaming tous les soirs, ambiance chill.',
   'ApSGADvCBScQ9jBN3zAraH1ZyyZSNsapcND3j7VHd1Ew')
on conflict (handle) do nothing;
