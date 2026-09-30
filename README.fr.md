# TipStreak

🇬🇧 [English](README.md) · 🇫🇷 Français

**Soutiens tes créateurs préférés en USDC, directement de wallet à wallet — et fais grandir ta série.**

TipStreak est une app mobile Solana (Android, Solana Mobile Wallet Adapter) de pourboires pour créateurs :
musique, dev, art, gaming, crypto… Les fans envoient des tips en USDC, sans intermédiaire, et la fidélité
est récompensée par des badges hebdomadaires. Les créateurs publient leur page en signant avec leur wallet
et reçoivent les tips directement dessus.

> Projet réalisé pour le hackathon Solana Mobile. Tourne sur **Solana devnet**.

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
│ Mobile Wallet Adapter│ ─── tx ────────────────────────────────────► │                │
│ (Phantom, Solflare…) │             │ Edge Functions :    │ relit tx │                │
│                      │ ──────────► │  record-tip  ───────────────────►│                │
│                      │             │  register-creator   │          └────────────────┘
└──────────────────────┘             └─────────────────────┘
```

**Stack** : Expo SDK 57 · React Native 0.86 · TypeScript · React Navigation · `@solana/web3.js` + `@solana/spl-token`
· Solana Mobile Wallet Adapter · Supabase (Postgres, RLS, Edge Functions Deno) · EAS Build.

```
src/
  context/WalletContext.tsx   connexion wallet, soldes, envoi tip / boost, signature de message
  context/DataContext.tsx     données Supabase, enregistrement des tips, publication créateur
  data/streaks.ts             calcul des streaks et paliers (semaines du lundi au dimanche)
  data/useCreatorTips.ts      tips reçus par un créateur
  navigation/linking.ts       liens profonds tipstreak://
  screens/                    Découvrir, Profil créateur, Tip, Soutiens, Historique, Espace créateur
supabase/
  migrations/                 schéma (tables, RLS, vue de stats)
  functions/record-tip/       vérification on-chain des tips
  functions/register-creator/ vérification de signature des créateurs
  seed.sql                    créateurs de démonstration
```

## Tester l'app

1. Installer l'APK **TipStreak (preview)** (lien de build EAS) sur un téléphone Android.
2. Installer **Phantom** ou **Solflare**, passer le wallet sur **devnet**.
3. Obtenir du SOL devnet (frais de transaction) et de l'USDC devnet (faucet Circle).
4. Onglet **Profil** → connecter le wallet. Onglet **Découvrir** → choisir un créateur → **Envoyer un tip**.
5. Pour recevoir : **Profil** → *Recevoir des tips* → choisir un handle → **Publier ma page** → signer.

> L'app suit la langue du téléphone (français ou anglais) ; le bouton **FR / EN** de l'onglet Profil permet de changer à tout moment.

## Développement

Prérequis : Node.js 24, un compte [Expo](https://expo.dev), un projet [Supabase](https://supabase.com), un téléphone Android.

```bash
npm install
```

**Supabase** (une fois) :
1. SQL Editor : exécuter `supabase/migrations/20260929000000_init.sql`, puis `supabase/seed.sql`.
2. Edge Functions : déployer `record-tip` et `register-creator` (code dans `supabase/functions/`),
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
| Vérification on-chain des tips (`record-tip`) | ✅ testé côté serveur |
| Mur des soutiens, espace créateur, paliers de fidélité | ✅ |
| Interface français / anglais, choix mémorisé | ✅ |
| Liens profonds `tipstreak://` | ✅ codé, à valider sur la build preview |
| Tip USDC de bout en bout | ⏳ en attente de SOL devnet (faucets saturés) |
| Boost SKR | ⏳ en attente du jeton de test TSKR |

## Suite (roadmap)

- **Payer en n'importe quel jeton** : swap via Jupiter (mainnet) directement vers le compte USDC du créateur,
  avec des frais de plateforme comme source de revenus.
- **Passage mainnet** : vrai jeton SKR (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`) et USDC mainnet.
- Photos de profil, avantages définis par les créateurs pour chaque palier, liens `https://` (App Links).

## Licence

Voir [LICENSE](LICENSE).
