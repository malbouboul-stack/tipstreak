# TipStreak

🇬🇧 [English](README.md) · 🇫🇷 Français

**Soutiens tes créateurs préférés en USDC, directement de wallet à wallet — et fais grandir ta série.**

TipStreak est une app mobile Solana (Android, Solana Mobile Wallet Adapter) de pourboires pour créateurs :
musique, dev, art, gaming, crypto… Les fans envoient des tips en USDC, sans intermédiaire, et la fidélité
est récompensée par des badges hebdomadaires. Les créateurs publient leur page en signant avec leur wallet
et reçoivent les tips directement dessus.

> Projet réalisé pour le hackathon Solana Mobile. Tourne sur **Solana devnet**.
>
> 📲 **Télécharger l'APK Android :** [TipStreak (preview) sur EAS](https://expo.dev/accounts/ibmd/projects/tipstreak/builds/29220317-9c40-4b8f-ac23-c8cdc058a9ee)
> · 🎬 Premier vrai tip, vérifié on-chain : [voir sur Solana Explorer](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet)

## Fonctionnalités

**Côté fan**
- **Découvrir** : liste des créateurs, recherche par nom ou handle, filtres générés depuis les catégories réelles.
- **Tip en USDC** : montants rapides ou libres, message optionnel signé dans la transaction (programme Memo).
- **Boost** (optionnel) : payer 5 SKR pour épingler son tip en haut du mur du créateur pendant 7 jours.
- **Mes soutiens** : créateurs soutenus, streak (semaines consécutives), total donné.
- **Badges de fidélité** : 💜 Supporter (1er tip) · 🔥 Fan actif (3 tips dans la semaine) · 🏆 Légende (8 semaines d'affilée).
- **Historique** de ses tips, groupé par jour.

**Côté créateur**
- **Publier sa page** : handle, nom, catégorie, bio — prouvé par une signature du wallet (gratuite, sans transaction).
- **Espace créateur** : supporters, USDC reçus (semaine / total), derniers tips et messages des fans.
- **Lien public** `tipstreak://<handle>` qui ouvre directement sa page dans l'app, à partager partout.
- Les tips arrivent **directement sur le wallet du créateur** : TipStreak ne détient jamais les fonds.

**Identité visuelle**
- Une identité qui mêle l'univers Solana (violet, vert) et celui de Solana Mobile / Seeker (cyan, typo monospace).
- Le logo : **7 barres qui montent, une par jour de la semaine, et une pièce dorée — le tip — sur la plus haute**.
  Le même motif remplit la carte « Ta semaine de soutien » au fil des tips.
- Écran de lancement animé, avatars en dégradé propres à chaque créateur, interface français / anglais.

## Comment la confiance est garantie

L'app ne peut **rien écrire** dans la base : elle n'a qu'une clé publique en lecture seule (Row Level Security).
Toutes les écritures passent par deux Edge Functions qui vérifient une preuve cryptographique :

| Action | Preuve vérifiée côté serveur |
|---|---|
| Enregistrer un tip (`record-tip`) | La transaction est relue **sur la blockchain** : elle a réussi, verse bien des USDC au wallet du créateur, et le fan en est le signataire. Montant, date et message viennent de la chaîne, jamais de l'app. La signature de transaction sert de clé : un tip ne compte qu'une fois. |
| Publier une page (`register-creator`) | Le créateur signe un message contenant son profil avec son wallet. Personne ne peut créer une page avec le wallet de quelqu'un d'autre pour détourner ses tips. |
| Boost | La transaction SKR est relue on-chain : bon montant, bon destinataire, même fan que le tip, utilisable une seule fois. |

Résultat : impossible d'inventer des tips, de gonfler un streak ou d'usurper un créateur.

## Architecture

```
 App Expo (Android)                      Supabase                         Solana devnet
┌──────────────────────┐   lecture   ┌─────────────────────┐          ┌────────────────┐
│ Découvrir / Profil / │ ──────────► │ creators, tips      │          │ USDC (SPL)     │
│ Soutiens / Historique│             │ vue creator_stats   │          │ SKR (SPL)      │
│                      │             │ (RLS : lecture seule)│          │ Memo           │
│ Mobile Wallet Adapter│ ── tx signée ──────────────────────────────► │                │
│ (Phantom, Solflare…) │             │ Edge Functions :    │ relit tx │                │
│                      │ ──────────► │  record-tip  ───────────────────►│                │
│                      │             │  register-creator   │          │                │
│                      │  secours    │  solana-rpc (relais) ──────────►│                │
└──────────────────────┘             └─────────────────────┘          └────────────────┘
```

**Pensée pour de vrais téléphones et de vrais réseaux**
- La transaction est entièrement préparée **avant** d'ouvrir le wallet ; le wallet ne fait que la **signer**,
  puis l'app l'envoie. La session wallet reste courte (plus d'erreur « session fermée ») et le wallet
  ne dépend jamais de son propre accès réseau.
- L'autorisation du wallet est mémorisée pendant la session : pas de « Connecter » à chaque tip.
- Les appels réseau sont retentés automatiquement, et les requêtes Solana basculent sur un relais Supabase
  (`solana-rpc`) quand le téléphone n'arrive pas à joindre le RPC public (DNS capricieux de certaines box).

**Stack** : Expo SDK 57 · React Native 0.86 · TypeScript · React Navigation · `@solana/web3.js` + `@solana/spl-token`
· Solana Mobile Wallet Adapter · Supabase (Postgres, RLS, Edge Functions Deno) · EAS Build.

```
src/
  context/WalletContext.tsx   connexion wallet, soldes, envoi tip / boost, signature de message
  context/DataContext.tsx     données Supabase, enregistrement des tips, publication créateur
  data/streaks.ts             calcul des streaks et paliers (semaines du lundi au dimanche)
  data/useCreatorTips.ts      tips reçus par un créateur
  lib/network.ts              nouvelles tentatives réseau + bascule sur le relais RPC
  i18n/                       textes français / anglais
  components/                 logo (StreakMark), écran de lancement, avatars, mur des soutiens, choix de langue
  navigation/linking.ts       liens profonds tipstreak://
  screens/                    Découvrir, Profil créateur, Tip, Soutiens, Historique, Espace créateur
supabase/
  migrations/                 schéma (tables, RLS, vue de stats)
  functions/record-tip/       vérification on-chain des tips
  functions/register-creator/ vérification de signature des créateurs
  functions/solana-rpc/       relais RPC en lecture (+ envoi de transactions déjà signées)
  seed.sql                    créateurs de démonstration
```

## Tester l'app

1. Installer l'APK **TipStreak (preview)** sur un téléphone Android :
   [page de la build EAS](https://expo.dev/accounts/ibmd/projects/tipstreak/builds/29220317-9c40-4b8f-ac23-c8cdc058a9ee).
2. Installer **Phantom** et activer le **mode Testnet** (Paramètres → Paramètres pour développeurs), réseau **Solana Devnet**.
3. Obtenir du SOL devnet ([faucet.solana.com](https://faucet.solana.com)) et de l'USDC devnet ([faucet.circle.com](https://faucet.circle.com), *Solana Devnet*).
4. Onglet **Profil** → connecter le wallet. Onglet **Découvrir** → choisir un créateur → **Envoyer un tip** → signer dans Phantom.
5. Pour recevoir : **Profil** → *Recevoir des tips* → choisir un handle → **Publier ma page** → signer (gratuit).

> L'app suit la langue du téléphone (français ou anglais) ; le bouton **🌐 FR ▾** en haut de Découvrir et de Profil
> permet de changer à tout moment.

## Développement

Prérequis : Node.js 24, un compte [Expo](https://expo.dev), un projet [Supabase](https://supabase.com), un téléphone Android.

```bash
npm install
```

**Supabase** (une fois) :
1. SQL Editor : exécuter `supabase/migrations/20260929000000_init.sql`, puis `supabase/seed.sql`.
2. Edge Functions : déployer `record-tip`, `register-creator` et `solana-rpc` (code dans `supabase/functions/`),
   avec *Verify JWT* désactivé (elles vérifient elles-mêmes leurs preuves).
3. Créer `.env.local` à la racine (ignoré par git) :
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

**Lancer** (avec une development build installée sur le téléphone) :
```bash
npx expo start
```

**Builds** (EAS) :
```bash
npx eas-cli@latest build -p android --profile development   # development build
npx eas-cli@latest build -p android --profile preview       # APK de démo, s'installe à côté
```

**Jeton SKR de test** : SKR n'existe que sur mainnet. `create-test-skr.js` crée un jeton de test « TSKR » sur devnet
et met à jour `src/constants/skr.ts` :
```bash
node create-test-skr.js <ADRESSE_DU_WALLET_DEVNET>
```
Pour activer la vérification des boosts, définir les secrets `TSKR_MINT` et `PLATFORM_WALLET` de l'Edge Function `record-tip`.

## État du projet

| Fonctionnalité | État |
|---|---|
| Connexion wallet, soldes SOL / USDC | ✅ |
| Base Supabase, lecture seule côté app | ✅ |
| Publication de page créateur par signature | ✅ testé avec Phantom |
| **Tip USDC de bout en bout** (signature Phantom → on-chain → vérifié → enregistré) | ✅ [testé sur un vrai téléphone](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet) |
| Vérification on-chain des tips (`record-tip`) | ✅ |
| Mur des soutiens, espace créateur, paliers de fidélité, séries hebdomadaires | ✅ |
| Interface français / anglais, choix mémorisé | ✅ |
| Écran de lancement animé, nouvelle identité et icône | ✅ |
| Liens profonds `tipstreak://` | ✅ codé |
| Boost SKR | 🛠️ codé (app + vérification on-chain), pas encore testé : nécessite le jeton de test TSKR sur devnet |

## Suite (roadmap)

- **Payer en n'importe quel jeton** : swap via Jupiter (mainnet) directement vers le compte USDC du créateur,
  avec des frais de plateforme comme source de revenus.
- **Passage mainnet** : vrai jeton SKR (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`) et USDC mainnet.
- Photos de profil, avantages définis par les créateurs pour chaque palier, liens `https://` (App Links).

## Licence

Voir [LICENSE](LICENSE).
