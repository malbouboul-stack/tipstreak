# TipStreak

🇬🇧 [English](README.md) · 🇫🇷 Français

**Soutiens tes créateurs préférés en USDC, directement de wallet à wallet — et fais grandir ta série.**

TipStreak est une app mobile Solana (Android, Solana Mobile Wallet Adapter) de pourboires pour créateurs :
musique, dev, art, gaming, crypto… Les fans envoient des tips en USDC, sans intermédiaire, et la fidélité
est récompensée par des badges hebdomadaires. Les créateurs publient leur page en signant avec leur wallet
et reçoivent les tips directement dessus.

> Projet réalisé pour le hackathon Solana Mobile. Tourne sur **Solana devnet**.
>
> 📲 **Télécharger l'APK Android :** [TipStreak (preview)](https://expo.dev/artifacts/eas/Lg17n8clN8FWtenPheJRpCWh031J-d7ylElnMQULz9w.apk) · 🎬 [Vidéo de démo](https://www.youtube.com/watch?v=76yhvYfAuUM)
> · ⛓️ Premier vrai tip, vérifié on-chain : [voir sur Solana Explorer](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet)

## Fonctionnalités

**Côté fan**
- **Découvrir** : liste des créateurs, recherche par nom ou handle, filtres générés depuis les catégories réelles.
- **Tip en USDC** : montants rapides ou libres, message optionnel signé dans la transaction (programme Memo).
- **Boost SKR** (optionnel) : ajouter 5 SKR pour le créateur afin d'épingler son tip en haut de son mur pendant 7 jours.
  Le tip USDC et le boost SKR partent dans **une seule transaction** : une seule validation dans le wallet, tout ou rien.
- **Soutenir TipStreak** (facultatif, désactivé par défaut) : ajouter 5 % pour la plateforme. Le créateur reçoit toujours 100 % du tip.
- **Mes soutiens** : créateurs soutenus, streak (semaines consécutives), total donné.
- **Badges de fidélité** : 💜 Supporter (1er tip) · 🔥 Fan actif (3 tips dans la semaine) · 🏆 Légende (8 semaines d'affilée).
- **Historique** de ses tips, groupé par jour.

**Côté créateur**
- **Photo de profil** : choisie dans la galerie, recadrée en carré et signée avec le wallet.
- **Publier sa page** : handle, nom, catégorie, bio — prouvé par une signature du wallet (gratuite, sans transaction).
- **Espace créateur** : supporters, USDC reçus (semaine / total), derniers tips et messages des fans.
- **Lien public** `tipstreak://<handle>` qui ouvre directement sa page dans l'app, à partager partout.
- Les tips arrivent **directement sur le wallet du créateur** : TipStreak ne détient jamais les fonds.

**Identité visuelle**
- Une identité qui mêle l'univers Solana (violet, vert) et celui de Solana Mobile / Seeker (cyan, typo monospace).
- Le logo : **7 barres qui montent, une par jour de la semaine, et une pièce dorée — le tip — sur la plus haute**.
  Le même motif remplit la carte « Ta semaine de soutien » au fil des tips.
- **Confirmation vivante** : dès la signature, les barres du logo ondulent pendant que Solana confirme, puis se remplissent
  et la pièce dorée tombe, avec un son doux et une légère vibration. Tous les messages utilisent la même carte sombre.
- Écran de lancement animé, photos de profil (ou avatars en dégradé), interface en **français, anglais, espagnol et
  portugais (Brésil)**, selon la langue du téléphone.

## Comment la confiance est garantie

L'app ne peut **rien écrire** dans la base : elle n'a qu'une clé publique en lecture seule (Row Level Security).
Toutes les écritures passent par deux Edge Functions qui vérifient une preuve cryptographique :

| Action | Preuve vérifiée côté serveur |
|---|---|
| Enregistrer un tip (`record-tip`) | La transaction est relue **sur la blockchain** : elle a réussi, verse bien des USDC au wallet du créateur, et le fan en est le signataire. Montant, date et message viennent de la chaîne, jamais de l'app. La signature de transaction sert de clé : un tip ne compte qu'une fois. |
| Publier une page (`register-creator`) | Le créateur signe un message contenant son profil avec son wallet. Personne ne peut créer une page avec le wallet de quelqu'un d'autre pour détourner ses tips. |
| Boost | La même transaction doit aussi verser au moins 5 SKR au créateur, depuis le même fan. Comme le tip, il ne compte qu'une fois. |

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
  context/WalletContext.tsx   connexion wallet, soldes, transaction tip + boost, signature de message
  context/DataContext.tsx     données Supabase, enregistrement des tips, publication créateur
  data/streaks.ts             calcul des streaks et paliers (semaines du lundi au dimanche)
  data/useCreatorTips.ts      tips reçus par un créateur
  lib/network.ts              nouvelles tentatives réseau + bascule sur le relais RPC
  i18n/                       textes français, anglais, espagnol, portugais (Brésil)
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
   [téléchargement direct de l'APK](https://expo.dev/artifacts/eas/Lg17n8clN8FWtenPheJRpCWh031J-d7ylElnMQULz9w.apk).
2. Installer **Phantom** et activer le **mode Testnet** (Paramètres → Paramètres pour développeurs), réseau **Solana Devnet**.
3. Obtenir du SOL devnet ([faucet.solana.com](https://faucet.solana.com)) et de l'USDC devnet ([faucet.circle.com](https://faucet.circle.com), *Solana Devnet*).
4. Onglet **Profil** → connecter le wallet. Onglet **Découvrir** → choisir un créateur → **Envoyer un tip** → signer dans Phantom.
5. Pour recevoir : **Profil** → *Recevoir des tips* → choisir un handle → **Publier ma page** → signer (gratuit).

> L'app suit la langue du téléphone (français, anglais, espagnol ou portugais) ; le bouton **🌐 FR ▾** en haut de Découvrir et de Profil
> permet de changer à tout moment.

## Développement

### Démarrage rapide (backend de démo public)

Le dépôt contient un fichier `.env` qui pointe vers le backend devnet public de TipStreak : l'app se lance dès
qu'elle est clonée, sans rien configurer sur Supabase. Prérequis : Node.js 24, le SDK Android d'Android Studio
(ou un compte [Expo](https://expo.dev) pour compiler dans le cloud), un téléphone Android ou un émulateur, et un
wallet (Phantom) pour envoyer des tips.

```bash
git clone https://github.com/malbouboul-stack/tipstreak.git && cd tipstreak
npm install
npx expo run:android        # compile l'app avec ses modules natifs et l'installe sur l'appareil branché
```

Pas de SDK Android ? Compiler une development build dans le cloud, l'installer sur le téléphone, puis lancer Metro :
```bash
npx eas-cli@latest build -p android --profile development
npx expo start
```

> TipStreak utilise des modules natifs (Mobile Wallet Adapter, SQLite, audio…) : il lui faut une development build,
> l'app ne tourne pas dans Expo Go.

### Ton propre backend (optionnel)

**Supabase** (une fois) :
1. SQL Editor : exécuter les fichiers de `supabase/migrations/` dans l'ordre, puis `supabase/seed.sql`.
2. Edge Functions : déployer `record-tip`, `register-creator`, `upload-avatar` et `solana-rpc` (code dans `supabase/functions/`),
   avec *Verify JWT* désactivé (elles vérifient elles-mêmes leurs preuves).
3. Créer `.env.local` à la racine (ignoré par git, prioritaire sur `.env`) :
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
Pour activer les boosts, définir le secret `TSKR_MINT` de l'Edge Function `record-tip`.

## État du projet

| Fonctionnalité | État |
|---|---|
| Connexion wallet (Mobile Wallet Adapter 2.0), soldes SOL / USDC | ✅ |
| **Tip USDC de bout en bout** (signature Phantom → on-chain → vérifié → enregistré) | ✅ [testé sur un vrai téléphone](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet) |
| Vérification on-chain de chaque tip (`record-tip`), base en lecture seule côté app | ✅ |
| **Boost SKR au créateur**, dans la même transaction que le tip | ✅ testé sur devnet (jeton de test TSKR) |
| **Contribution volontaire à TipStreak** (+5 %), dans la même transaction | ✅ testée sur devnet |
| Pages créateur et **photos de profil**, signées par le wallet du créateur | ✅ testé avec Phantom |
| Mur des soutiens, espace créateur, paliers de fidélité, séries hebdomadaires, historique | ✅ |
| **Confirmation vivante** : logo animé, son doux, vibration ; fenêtres au style de l'app | ✅ |
| Interface en **4 langues** (FR, EN, ES, PT-BR), suit le téléphone, choix mémorisé | ✅ |
| Écran de lancement animé, identité visuelle et icône | ✅ |
| Liens profonds `tipstreak://` | ✅ |
| Testé par de vrais utilisateurs, sur leurs propres téléphones et wallets | ✅ 3 testeurs |
| Audit de sécurité du hackathon traité ([SECURITY.md](SECURITY.md)) | ✅ |

## Modèle économique

Les créateurs reçoivent toujours **100 % de leurs tips et boosts**. TipStreak gagne sa vie avec des services facultatifs :
- **En place :** « Soutenir TipStreak » +5 % au moment du tip, facultatif et désactivé par défaut (le modèle de GoFundMe).
- **Ensuite :** tip avec n'importe quel jeton (SOL, BONK…) : un swap Jupiter verse des USDC au créateur, petite commission sur le swap uniquement.
- **Ensuite :** **tips sponsorisés** : une marque double les tips d'une catégorie pendant une semaine (« [Marque] double tes tips musique »).
  Le budget pub va aux créateurs au lieu de les interrompre, TipStreak prend une commission sur la campagne. Aucune bannière de pub dans l'app.
- **Plus tard :** Créateur Pro (avantages par palier, statistiques, page personnalisée) et un overlay pour les créateurs en live.

## Suite (roadmap)

- **Bêta mainnet** avec une dizaine de vrais créateurs : USDC mainnet et vrai jeton SKR (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`),
  RPC dédié, trésorerie sur un wallet matériel / multisig, plafond par tip pendant la bêta, revue de sécurité des Edge Functions.
- Publication sur le **Solana dApp Store**.
- **Créateurs vérifiés** (compte X / YouTube lié) avant d'apparaître dans Découvrir.
- **Frais réseau sponsorisés** : TipStreak paie les frais de transaction du fan, un tip ne demande que des USDC.
- **Payer avec n'importe quel jeton** (swap Jupiter) et **tips sponsorisés** (cf. modèle économique).
- **Payer par carte, retirer vers sa banque** : un partenaire « on-ramp » (Stripe, MoonPay, Coinbase Onramp…) permet aux fans
  sans wallet crypto de donner par carte ou Apple / Google Pay, le créateur recevant toujours des USDC, et aux créateurs de
  retirer vers leur compte bancaire. Le partenaire gère la vérification d'identité et les licences : TipStreak s'ouvre aux
  plus de 95 % de fans qui n'ont pas encore de crypto.
- Notifications de tips pour les créateurs, avantages définis par les créateurs pour chaque palier, liens `https://` (App Links), overlay de live.

## Licence

Voir [LICENSE](LICENSE).
