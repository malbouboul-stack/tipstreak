# TipStreak

🇬🇧 English · 🇫🇷 [Français](README.fr.md)

**Support your favorite creators in USDC, straight from wallet to wallet — and grow your streak.**

TipStreak is a Solana mobile app (Android, Solana Mobile Wallet Adapter) for tipping creators:
music, dev, art, gaming, crypto… Fans send tips in USDC with no middleman, and loyalty is rewarded with
weekly badges. Creators publish their page by signing with their wallet and receive tips directly on it.

> Built for the Solana Mobile hackathon. Runs on **Solana devnet**.

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
│ Mobile Wallet Adapter│ ─── tx ────────────────────────────────────► │                │
│ (Phantom, Solflare…) │             │ Edge Functions:     │ re-reads │                │
│                      │ ──────────► │  record-tip  ───────────────────►│                │
│                      │             │  register-creator   │          └────────────────┘
└──────────────────────┘             └─────────────────────┘
```

**Stack**: Expo SDK 57 · React Native 0.86 · TypeScript · React Navigation · `@solana/web3.js` + `@solana/spl-token`
· Solana Mobile Wallet Adapter · Supabase (Postgres, RLS, Deno Edge Functions) · EAS Build.

```
src/
  context/WalletContext.tsx   wallet connection, balances, tip / boost transfers, message signing
  context/DataContext.tsx     Supabase data, tip recording, creator publishing
  data/streaks.ts             streak and tier computation (Monday-to-Sunday weeks)
  data/useCreatorTips.ts      tips received by a creator
  navigation/linking.ts       tipstreak:// deep links
  screens/                    Discover, Creator profile, Tip, Support, History, Creator space
supabase/
  migrations/                 schema (tables, RLS, stats view)
  functions/record-tip/       on-chain tip verification
  functions/register-creator/ creator signature verification
  seed.sql                    demo creators
```

## Try the app

1. Install the **TipStreak (preview)** APK (EAS build link) on an Android phone.
2. Install **Phantom** or **Solflare** and switch the wallet to **devnet**.
3. Get devnet SOL (transaction fees) and devnet USDC (Circle faucet).
4. **Profile** tab → connect your wallet. **Discover** tab → pick a creator → **Send a tip**.
5. To receive tips: **Profile** → *Receive tips* → choose a handle → **Publish my page** → sign.

> The app follows the phone's language (English or French); switch it anytime with the **FR / EN** toggle in the Profile tab.

## Development

Requirements: Node.js 24, an [Expo](https://expo.dev) account, a [Supabase](https://supabase.com) project, an Android phone.

```bash
npm install
```

**Supabase** (once):
1. SQL Editor: run `supabase/migrations/20260929000000_init.sql`, then `supabase/seed.sql`.
2. Edge Functions: deploy `record-tip` and `register-creator` (code in `supabase/functions/`),
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
| On-chain tip verification (`record-tip`) | ✅ tested server-side |
| Support wall, creator space, loyalty tiers | ✅ |
| English / French interface, remembered choice | ✅ |
| `tipstreak://` deep links | ✅ implemented, to validate on the preview build |
| End-to-end USDC tip | ⏳ waiting for devnet SOL (faucets rate-limited) |
| SKR boost | ⏳ waiting for the TSKR test token |

## Roadmap

- **Pay with any token**: Jupiter swap (mainnet) straight into the creator's USDC account,
  with a platform fee as a revenue stream.
- **Mainnet launch**: real SKR token (`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`) and mainnet USDC.
- Profile pictures, creator-defined perks for each tier, `https://` links (App Links).

## License

See [LICENSE](LICENSE).
