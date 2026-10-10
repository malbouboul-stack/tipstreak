# TipStreak

🇬🇧 English · 🇫🇷 [Français](README.fr.md)

**Support your favorite creators in USDC, straight from wallet to wallet — and grow your streak.**

TipStreak is a Solana mobile app (Android, Solana Mobile Wallet Adapter) for tipping creators:
music, dev, art, gaming, crypto… Fans send tips in USDC with no middleman, and loyalty is rewarded with
weekly badges. Creators publish their page by signing with their wallet and receive tips directly on it.

> Built for the Solana Mobile hackathon. Runs on **Solana devnet**.
>
> 📲 **Download the Android APK:** [TipStreak (preview)](https://expo.dev/artifacts/eas/e3oU4YwH4nhccJ8R-FEXYwEvKSMdZHfS2krsOgvif8o.apk) · 🎬 [Demo video](https://www.youtube.com/watch?v=76yhvYfAuUM)
> · ⛓️ First real tip, verified on-chain: [view on Solana Explorer](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet)

## Features

**For fans**
- **Discover**: creator list, search by name or handle, filters generated from the real categories.
- **USDC tips**: quick or custom amounts, optional message signed inside the transaction (Memo program).
- **SKR boost** (optional): add 5 SKR for the creator to pin your tip at the top of their wall for 7 days.
  The USDC tip and the SKR boost go in **one transaction**: a single wallet approval, all or nothing.
- **Support TipStreak** (optional, off by default): add 5% for the platform. The creator always gets 100% of the tip.
- **My support**: creators you support, streak (consecutive weeks), total given.
- **Loyalty badges**: 💜 Supporter (first tip) · 🔥 Active fan (3 tips in a week) · 🏆 Legend (8 weeks in a row).
- **History** of your tips, grouped by day.

**For creators**
- **Profile photo**: pick a photo from the gallery, cropped to a square and signed with the wallet.
- **Publish a page**: handle, name, category, bio — proven by a wallet signature (free, no transaction).
- **Creator space**: supporters, USDC received (this week / all time), latest tips and fan messages.
- **Public link** `tipstreak://<handle>` that opens the creator's page directly in the app.
- Tips land **directly in the creator's wallet**: TipStreak never holds funds.

**Look & feel**
- A visual identity mixing the Solana world (purple, green) and the Solana Mobile / Seeker world (cyan, monospace type).
- The logo: **7 rising bars, one per day of the week, and a gold coin — the tip — on the tallest one**.
  The same motif fills the "Your support week" card as you tip.
- **Live tip confirmation**: as soon as the wallet signs, the logo's bars pulse while Solana confirms, then fill up and the
  gold coin drops with a soft chime and a light haptic. Every message uses the same dark card, never a system dialog.
- Animated launch screen, profile photos (or per-creator gradient avatars), interface in **English, French, Spanish and
  Portuguese (Brazil)**, following the phone's language.

## How trust is guaranteed

The app cannot **write** anything to the database: it only has a public, read-only key (Row Level Security).
Every write goes through one of two Edge Functions that check a cryptographic proof first:

| Action | Proof checked server-side |
|---|---|
| Record a tip (`record-tip`) | The transaction is re-read **on-chain**: it succeeded, it sends USDC to the creator's wallet, and the fan signed it. Amount, date and message come from the chain, never from the app. The transaction signature is the primary key, so a tip can only count once. |
| Publish a page (`register-creator`) | The creator signs a message containing their profile with their wallet. Nobody can create a page with someone else's wallet to divert their tips. |
| Boost | The same transaction must also pay at least 5 SKR to the creator, from the same fan. Like the tip, it can only count once. |

Result: fake tips, inflated streaks and creator impersonation are impossible.

## Architecture

```
 Expo app (Android)                      Supabase                         Solana devnet
┌──────────────────────┐    read     ┌─────────────────────┐          ┌────────────────┐
│ Discover / Profile / │ ──────────► │ creators, tips      │          │ USDC (SPL)     │
│ Support / History    │             │ creator_stats view  │          │ SKR (SPL)      │
│                      │             │ (RLS: read-only)    │          │ Memo           │
│ Mobile Wallet Adapter│ ── signed tx ──────────────────────────────► │                │
│ (Phantom, Solflare…) │             │ Edge Functions:     │ re-reads │                │
│                      │ ──────────► │  record-tip  ───────────────────►│                │
│                      │             │  register-creator   │          │                │
│                      │  fallback   │  solana-rpc (relay) ───────────►│                │
└──────────────────────┘             └─────────────────────┘          └────────────────┘
```

**Built for real phones and real networks**
- The transaction is fully prepared **before** the wallet opens; the wallet only **signs** it, then the app sends it.
  The wallet session stays short (no "session closed" errors) and the wallet never depends on its own network access.
- The wallet authorization is remembered for the session: no "Connect" prompt on every tip.
- Network calls retry automatically, and Solana requests fall back to a Supabase relay (`solana-rpc`)
  when the phone cannot reach the public RPC (flaky DNS on some home Wi-Fi networks).

**Stack**: Expo SDK 57 · React Native 0.86 · TypeScript · React Navigation · `@solana/web3.js` + `@solana/spl-token`
· Solana Mobile Wallet Adapter · Supabase (Postgres, RLS, Deno Edge Functions) · EAS Build.

```
src/
  context/WalletContext.tsx   wallet connection, balances, tip + boost transaction, message signing
  context/DataContext.tsx     Supabase data, tip recording, creator publishing
  data/streaks.ts             streak and tier computation (Monday-to-Sunday weeks)
  data/useCreatorTips.ts      tips received by a creator
  lib/network.ts              network retries + RPC relay fallback
  i18n/                       English, French, Spanish, Portuguese (Brazil) texts
  components/                 logo (StreakMark), launch screen, avatars, support wall, language picker
  navigation/linking.ts       tipstreak:// deep links
  screens/                    Discover, Creator profile, Tip, Support, History, Creator space
supabase/
  migrations/                 schema (tables, RLS, stats view)
  functions/record-tip/       on-chain tip verification
  functions/register-creator/ creator signature verification
  functions/solana-rpc/       read-only RPC relay (+ sending already-signed transactions)
  seed.sql                    demo creators
```

## Try the app

1. Install the **TipStreak (preview)** APK on an Android phone:
   [direct APK download](https://expo.dev/artifacts/eas/e3oU4YwH4nhccJ8R-FEXYwEvKSMdZHfS2krsOgvif8o.apk).
2. Install **Phantom** and turn on **Testnet mode** (Settings → Developer settings), network **Solana Devnet**.
3. Get devnet SOL ([faucet.solana.com](https://faucet.solana.com)) and devnet USDC ([faucet.circle.com](https://faucet.circle.com), *Solana Devnet*).
4. **Profile** tab → connect your wallet. **Discover** tab → pick a creator → **Send a tip** → sign in Phantom.
5. To receive tips: **Profile** → *Receive tips* → choose a handle → **Publish my page** → sign (free).

> The app follows the phone's language (English, French, Spanish or Portuguese); switch it anytime with the **🌐 FR ▾** button
> at the top of Discover and Profile.

## Development

### Quick start (public demo backend)

The repository ships a `.env` pointing to TipStreak's public devnet backend, so the app runs as soon as it's cloned:
no Supabase setup needed. Requirements: Node.js 24, Android Studio's SDK (or an [Expo](https://expo.dev) account
to build in the cloud), an Android phone or emulator, and a wallet app (Phantom) for tipping.

```bash
git clone https://github.com/malbouboul-stack/tipstreak.git && cd tipstreak
npm install
npx expo run:android        # builds the app with its native modules and installs it on the connected device
```

No Android SDK? Build a development client in the cloud instead, install it on the phone, then start Metro:
```bash
npx eas-cli@latest build -p android --profile development
npx expo start
```

> TipStreak uses native modules (Mobile Wallet Adapter, SQLite, audio…), so it needs a development build:
> it doesn't run in Expo Go.

### Your own backend (optional)

**Supabase** (once):
1. SQL Editor: run the files of `supabase/migrations/` in order, then `supabase/seed.sql`.
2. Edge Functions: deploy `record-tip`, `register-creator`, `upload-avatar` and `solana-rpc` (code in `supabase/functions/`),
   with *Verify JWT* turned off (they verify their own proofs).
3. Create `.env.local` at the project root (git-ignored, takes precedence over `.env`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

**Run** (with a development build installed on the phone):
```bash
npx expo start
```

**Builds** (EAS):
```bash
npx eas-cli@latest build -p android --profile development   # development build
npx eas-cli@latest build -p android --profile preview       # demo APK, installs side by side
```

**Test SKR token**: SKR only exists on mainnet. `create-test-skr.js` creates a "TSKR" test token on devnet
and updates `src/constants/skr.ts`:
```bash
node create-test-skr.js <DEVNET_WALLET_ADDRESS>
```
To enable boosts, set the `TSKR_MINT` secret on the `record-tip` Edge Function.

## Project status

| Feature | Status |
|---|---|
| Wallet connection (Mobile Wallet Adapter 2.0), SOL / USDC balances | ✅ |
| **End-to-end USDC tip** (Phantom signature → on-chain → verified → recorded) | ✅ [tested on a real phone](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet) |
| On-chain verification of every tip (`record-tip`), read-only database from the app | ✅ |
| **SKR boost to the creator**, in the same transaction as the tip | ✅ tested on devnet (TSKR test token) |
| **Optional contribution to TipStreak** (+5%), in the same transaction | ✅ tested on devnet |
| Creator pages and **profile photos**, signed by the creator's wallet | ✅ tested with Phantom |
| Support wall, creator space, loyalty tiers, weekly streaks, history | ✅ |
| **Live tip confirmation**: animated logo, soft chime, haptics; in-app dialogs in the app's style | ✅ |
| Interface in **4 languages** (EN, FR, ES, PT-BR), follows the phone, remembered choice | ✅ |
| Animated launch screen, brand identity and app icon | ✅ |
| `tipstreak://` deep links | ✅ |
| Tested by real users on their own Android phones and wallets | ✅ 3 testers |
| Hackathon security audit answered ([SECURITY.md](SECURITY.md)) | ✅ |

## Business model

Creators always receive **100% of their tips and boosts**. TipStreak earns from optional services:
- **Live:** an optional "Support TipStreak" +5% when tipping, off by default (the GoFundMe model).
- **Next:** tip with any token (SOL, BONK…): a Jupiter swap lands USDC in the creator's wallet, with a small fee on the swap only.
- **Next:** **sponsored tips**: a brand matches tips in a category for a week ("[Brand] doubles your music tips").
  The ad budget goes to creators instead of interrupting them, and TipStreak takes a campaign fee. No banner ads in the app.
- **Later:** Creator Pro (perks per loyalty tier, supporter analytics, custom page) and a stream overlay for live creators.

## Roadmap

- **Mainnet beta** with ~10 real creators: mainnet USDC and the real SKR token (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`),
  dedicated RPC, treasury on a hardware / multisig wallet, per-tip cap during the beta, security review of the Edge Functions.
- **Solana dApp Store** listing.
- **Verified creators** (linked X / YouTube account) before appearing in Discover.
- **Sponsored network fees**: TipStreak pays the fan's transaction fees, so a tip only needs USDC.
- **Pay with any token** (Jupiter swap) and **sponsored tips** (see business model).
- **Pay by card, cash out to a bank**: an on-ramp partner (Stripe, MoonPay, Coinbase Onramp…) lets fans without a crypto
  wallet tip by card or Apple / Google Pay while the creator still receives USDC, and creators can withdraw to their bank.
  The partner handles KYC and licensing; this opens TipStreak to the 95%+ of fans who don't hold crypto yet.
- Tip notifications for creators, creator-defined perks for each tier, `https://` creator links (App Links), stream overlay.

## License

See [LICENSE](LICENSE).
