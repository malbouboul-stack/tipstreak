# Security

TipStreak moves real tokens between wallets, so the design assumes the app itself can't be trusted:
anything it says is re-checked against the chain or a wallet signature before it's stored.

## Security model

| Layer | What protects it |
|---|---|
| Funds | Tips and boosts go **directly from the fan's wallet to the creator's wallet**. TipStreak never holds keys or funds. The wallet (Phantom, Solflare…) signs through Mobile Wallet Adapter; the app never sees a private key. |
| Database writes | The app only has the Supabase **publishable** key, which Row Level Security limits to **read-only** access. Every write goes through an Edge Function that checks a proof. |
| Tips (`record-tip`) | The transaction is re-read on-chain: it succeeded, paid USDC to the creator's wallet, and the fan signed it. Amount, time and message come from the chain, never from the app. The signature is the primary key, so a tip counts once. |
| SKR boosts | The same transaction must also pay at least 5 SKR to the creator, from the same fan. |
| Creator pages (`register-creator`) | An ed25519 signature of the profile by the creator's wallet, with an expiry, so nobody can publish a page with someone else's wallet to divert tips. |
| RPC relay (`solana-rpc`) | Allow-list of read methods plus `sendTransaction` for transactions that are already signed by the user's wallet. |

## Notes on the hackathon security audit

**"Leaked secret" in `src/lib/supabase.ts`: not a secret.** `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is Supabase's
*publishable* key. It's designed to ship inside client apps, and here it can only read public data (RLS).
The server-side key (`SUPABASE_SECRET_KEYS`) exists only inside the Edge Functions and is never in the repository.
Local keypairs used for devnet tooling (`.skr-mint-authority.json`, `.demo-creator-wallets.json`) and `.env.local`
are git-ignored.

**Transitive dependencies:**

| Package | Pulled in by | Status |
|---|---|---|
| `uuid` < 11.1.1 | `jayson` (via `@solana/web3.js`), `xcode` (via Expo config plugins) | **Fixed**: forced to `uuid@11.1.1` with `overrides` in `package.json`. |
| `bigint-buffer` 1.1.5 | `@solana/buffer-layout-utils` (via `@solana/spl-token`) | No patched release exists upstream. In TipStreak it only encodes amounts the app computes itself (`transferChecked`), never attacker-supplied buffers. Will go away when we move to `@solana/kit`. |
| `stream-json` 1.9.1 | `jayson` (via `@solana/web3.js`) | The fix is only in a breaking major version that `jayson` 4 doesn't support. The app is an RPC *client* talking to Solana RPC / our relay, not a server parsing untrusted JSON. |

## Reporting

Found something? Please open a GitHub issue without exploit details, or contact the maintainer through GitHub,
and we'll follow up privately.
