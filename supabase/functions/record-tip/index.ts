// Edge Function record-tip : seul point d'entrée pour écrire un tip en base.
//
// L'app envoie { signature, creatorId, boostSignature? } juste après la transaction.
// On relit la transaction sur Solana devnet et on n'enregistre que ce qu'elle prouve :
//   - elle a réussi et verse bien des USDC au wallet du créateur ;
//   - le fan est le signataire dont le solde USDC a baissé du même montant ;
//   - montant, date (heure du bloc) et message (memo) viennent de la chaîne, jamais de l'app.
// La signature est la clé primaire : un même tip ne peut pas être compté deux fois.

import { createClient } from 'npm:@supabase/supabase-js@2';

const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // USDC devnet, cf. WalletContext.tsx
const USDC_DECIMALS = 6;
const BOOST_COST_RAW = 5_000_000n; // 5 TSKR (6 décimales), cf. BOOST_COST_SKR dans TipScreen.tsx
const MAX_MESSAGE_LENGTH = 280;

const RPC_URL = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.devnet.solana.com';
// Secrets à définir quand le jeton TSKR existera (boost refusé tant qu'ils manquent)
const TSKR_MINT = Deno.env.get('TSKR_MINT');
const PLATFORM_WALLET = Deno.env.get('PLATFORM_WALLET');

// Clé secrète fournie automatiquement par Supabase : contourne RLS, ne quitte jamais le serveur
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!).default,
  { auth: { persistSession: false } }
);

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type TokenBalance = { mint: string; owner?: string; uiTokenAmount: { amount: string } };
type ParsedTransaction = {
  blockTime: number | null;
  meta: { err: unknown; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: { program?: string; parsed?: unknown }[];
    };
  };
};

const BASE58_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchTransaction(signature: string): Promise<ParsedTransaction> {
  // Juste après l'envoi, le RPC peut ne pas encore voir la transaction : on réessaie un peu
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
      }),
    });
    const json = await res.json();
    if (json.error) throw new HttpError(502, `RPC Solana : ${json.error.message}`);
    if (json.result) return json.result;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new HttpError(404, 'Transaction introuvable sur devnet (pas encore confirmée ?)');
}

// Variation de solde (unités brutes) de chaque propriétaire pour un mint donné.
// Un compte token créé dans la transaction n'a pas de solde "avant" : il compte pour 0.
function balanceDeltas(tx: ParsedTransaction, mint: string): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  const add = (balances: TokenBalance[] | undefined, sign: bigint) => {
    for (const b of balances ?? []) {
      if (b.mint !== mint || !b.owner) continue;
      deltas.set(b.owner, (deltas.get(b.owner) ?? 0n) + sign * BigInt(b.uiTokenAmount.amount));
    }
  };
  add(tx.meta?.preTokenBalances, -1n);
  add(tx.meta?.postTokenBalances, 1n);
  return deltas;
}

// Vérifie un transfert de `mint` vers `recipient` et renvoie qui l'a payé et combien
function verifyTransfer(tx: ParsedTransaction, mint: string, recipient: string, label: string) {
  if (!tx.meta || tx.meta.err) throw new HttpError(400, `La transaction ${label} a échoué on-chain`);

  const deltas = balanceDeltas(tx, mint);
  const amount = deltas.get(recipient) ?? 0n;
  if (amount <= 0n) throw new HttpError(400, `La transaction ${label} ne verse rien au bon destinataire`);

  const signers = new Set(tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey));
  const fan = [...deltas].find(([owner, delta]) => owner !== recipient && delta === -amount && signers.has(owner))?.[0];
  if (!fan) throw new HttpError(400, `Impossible d'identifier le signataire de la transaction ${label}`);

  return { fan, amount };
}

function readMemo(tx: ParsedTransaction): string | null {
  const memo = tx.transaction.message.instructions.find((ix) => ix.program === 'spl-memo')?.parsed;
  if (typeof memo !== 'string' || !memo.trim()) return null;
  return memo.trim().slice(0, MAX_MESSAGE_LENGTH);
}

function formatUnits(raw: bigint, decimals: number): string {
  const digits = raw.toString().padStart(decimals + 1, '0');
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

const json = (status: number, body: unknown) => Response.json(body, { status });

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST uniquement');

    const body = await req.json().catch(() => null);
    const signature: unknown = body?.signature;
    const creatorId: unknown = body?.creatorId;
    const boostSignature: unknown = body?.boostSignature ?? null;

    if (typeof signature !== 'string' || !BASE58_SIGNATURE.test(signature)) throw new HttpError(400, 'signature invalide');
    if (typeof creatorId !== 'string' || !UUID.test(creatorId)) throw new HttpError(400, 'creatorId invalide');
    if (boostSignature !== null && (typeof boostSignature !== 'string' || !BASE58_SIGNATURE.test(boostSignature))) {
      throw new HttpError(400, 'boostSignature invalide');
    }

    // Déjà enregistré (le téléphone a réessayé) : on renvoie simplement la ligne existante
    const existing = await supabase.from('tips').select().eq('signature', signature).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return json(200, existing.data);

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id, wallet_address')
      .eq('id', creatorId)
      .maybeSingle();
    if (creatorError) throw creatorError;
    if (!creator) throw new HttpError(404, 'Créateur inconnu');

    const tx = await fetchTransaction(signature);
    const { fan, amount } = verifyTransfer(tx, USDC_MINT, creator.wallet_address, 'de tip');
    if (tx.blockTime == null) throw new HttpError(502, 'Heure du bloc indisponible, réessaie dans quelques secondes');

    if (boostSignature) {
      if (!TSKR_MINT || !PLATFORM_WALLET) throw new HttpError(400, 'Boost pas encore configuré sur le serveur');
      const boost = verifyTransfer(await fetchTransaction(boostSignature), TSKR_MINT, PLATFORM_WALLET, 'de boost');
      if (boost.fan !== fan) throw new HttpError(400, 'Le boost ne vient pas du même wallet que le tip');
      if (boost.amount < BOOST_COST_RAW) throw new HttpError(400, 'Montant du boost insuffisant');
    }

    const { data, error } = await supabase
      .from('tips')
      .insert({
        signature,
        fan_wallet: fan,
        creator_id: creator.id,
        amount: formatUnits(amount, USDC_DECIMALS),
        boosted: boostSignature !== null,
        boost_signature: boostSignature,
        message: readMemo(tx),
        created_at: new Date(tx.blockTime * 1000).toISOString(),
      })
      .select()
      .single();

    if (error?.code === '23505') {
      // Doublon : soit deux envois simultanés du même tip, soit un boost réutilisé
      const race = await supabase.from('tips').select().eq('signature', signature).maybeSingle();
      if (race.data) return json(200, race.data);
      throw new HttpError(409, 'Ce boost a déjà été utilisé pour un autre tip');
    }
    if (error) throw error;

    return json(201, data);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error('record-tip', e);
    return json(500, { error: 'Erreur interne' });
  }
});
