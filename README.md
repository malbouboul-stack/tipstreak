# TipStreak

🇬🇧 English · 🇫🇷 [Français](README.fr.md)

**Support your favorite creators in USDC, straight from wallet to wallet — and grow your streak.**

TipStreak is a Solana mobile app (Android, Solana Mobile Wallet Adapter) for tipping creators:
music, dev, art, gaming, crypto… Fans send tips in USDC with no middleman, and loyalty is rewarded with
weekly badges. Creators publish their page by signing with their wallet and receive tips directly on it.

> Built for the Solana Mobile hackathon. Runs on **Solana devnet**.
>
> 📲 **Download the Android APK:** [TipStreak (preview) on EAS](https://expo.dev/accounts/ibmd/projects/tipstreak/builds/29220317-9c40-4b8f-ac23-c8cdc058a9ee)
> · 🎬 First real tip, verified on-chain: [view on Solana Explorer](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet)

## Features

**For fans**
- **Discover**: creator list, search by name or handle, filters generated from the real categories.
- **USDC tips**: quick or custom amounts, optional message signed inside the transaction (Memo program).
- **Boost** (optional): pay 5 SKR to pin your tip at the top of the creator's wall for 7 days.
- **My support**: creators you support, streak (consecutive weeks), total given.
- **Loyalty badges**: 💜 Supporter (first tip) · 🔥 Active fan (3 tips in a week) · 🏆 Legend (8 weeks in a row).
- **History** of your tips, grouped by day.

**For creators**
- **Publish a page**: handle, name, category, bio — proven by a wallet signature (free, no transaction).
- **Creator space**: supporters, USDC received (this week / all time), latest tips and fan messages.
- **Public link** `tipstreak://<handle>` that opens the creator's page directly in the app.
- Tips land **directly in the creator's wallet**: TipStreak never holds funds.

**Look & feel**
- A visual identity mixing the Solana world (purple, green) and the Solana Mobile / Seeker world (cyan, monospace type).
- The logo: **7 rising bars, one per day of the week, and a gold coin — the tip — on the tallest one**.
  The same motif fills the "Your support week" card as you tip.
- Animated launch screen, per-creator gradient avatars, English / French interface.

## How trust is guaranteed

The app cannot **write** anything to the database: it only has a public, read-only key (Row Level Security).
Every write goes through one of two Edge Functions that check a cryptographic proof first:

| Action | Proof checked server-side |
|---|---|
| Record a tip (`record-tip`) | The transaction is re-read **on-chain**: it succeeded, it sends USDC to the creator's wallet, and the fan signed it. Amount, date and message come from the chain, never from the app. The transaction signature is the primary key, so a tip can only count once. |
| Publish a page (`register-creator`) | The creator signs a message containing their profile with their wallet. Nobody can create a page with someone else's wallet to divert their tips. |
| Boost | The SKR transaction is re-read on-chain: right amount, right recipient, same fan as the tip, usable only once. |

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
  context/WalletContext.tsx   wallet connection, balances, tip / boost transfers, message signing
  context/DataContext.tsx     Supabase data, tip recording, creator publishing
  data/streaks.ts             streak and tier computation (Monday-to-Sunday weeks)
  data/useCreatorTips.ts      tips received by a creator
  lib/network.ts              network retries + RPC relay fallback
  i18n/                       English / French texts
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
   [EAS build page](https://expo.dev/accounts/ibmd/projects/tipstreak/builds/29220317-9c40-4b8f-ac23-c8cdc058a9ee).
2. Install **Phantom** and turn on **Testnet mode** (Settings → Developer settings), network **Solana Devnet**.
3. Get devnet SOL ([faucet.solana.com](https://faucet.solana.com)) and devnet USDC ([faucet.circle.com](https://faucet.circle.com), *Solana Devnet*).
4. **Profile** tab → connect your wallet. **Discover** tab → pick a creator → **Send a tip** → sign in Phantom.
5. To receive tips: **Profile** → *Receive tips* → choose a handle → **Publish my page** → sign (free).

> The app follows the phone's language (English or French); switch it anytime with the **🌐 FR ▾** button
> at the top of Discover and Profile.

## Development

Requirements: Node.js 24, an [Expo](https://expo.dev) account, a [Supabase](https://supabase.com) project, an Android phone.

```bash
npm install
```

**Supabase** (once):
1. SQL Editor: run `supabase/migrations/20260929000000_init.sql`, then `supabase/seed.sql`.
2. Edge Functions: deploy `record-tip`, `register-creator` and `solana-rpc` (code in `supabase/functions/`),
   with *Verify JWT* turned off (they verify their own proofs).
3. Create `.env.local` at the project root (git-ignored):
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
To enable boost verification, set the `TSKR_MINT` and `PLATFORM_WALLET` secrets on the `record-tip` Edge Function.

## Project status

| Feature | Status |
|---|---|
| Wallet connection, SOL / USDC balances | ✅ |
| Supabase database, read-only from the app | ✅ |
| Creator page publishing by signature | ✅ tested with Phantom |
| **End-to-end USDC tip** (Phantom signature → on-chain → verified → recorded) | ✅ [tested on a real phone](https://explorer.solana.com/tx/5PHxeGeQkVXohGEkySTtjCRsXq6RRUhnrStzms84zb3FUFJ6jwwvuTTWa1Q43kthasJejcqKVa71djhPaiAp179F?cluster=devnet) |
| On-chain tip verification (`record-tip`) | ✅ |
| Support wall, creator space, loyalty tiers, weekly streaks | ✅ |
| English / French interface, remembered choice | ✅ |
| Animated launch screen, new identity and app icon | ✅ |
| `tipstreak://` deep links | ✅ implemented |
| SKR boost | 🛠️ implemented (app + on-chain verification), not yet tested: needs the TSKR devnet test token |

## Roadmap

- **Pay with any token**: Jupiter swap (mainnet) straight into the creator's USDC account,
  with a platform fee as a revenue stream.
- **Mainnet launch**: real SKR token (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`) and mainnet USDC.
- Profile pictures, creator-defined perks for each tier, `https://` links (App Links).

## License

See [LICENSE](LICENSE).
