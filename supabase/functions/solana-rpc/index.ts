// Edge Function solana-rpc : relais vers le RPC Solana devnet.
//
// Certains téléphones n'arrivent pas à résoudre api.devnet.solana.com (DNS de la box, DNS privé,
// bloqueur de pub…) alors qu'ils joignent très bien Supabase. L'app essaie d'abord le RPC direct,
// et ne passe par ce relais qu'en cas d'échec réseau.
// Seules les méthodes de lecture utilisées par l'app sont relayées : pas d'envoi de transaction
// (c'est le wallet qui les envoie lui-même).

const RPC_URL = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.devnet.solana.com';

const ALLOWED_METHODS = new Set([
  'getAccountInfo',
  'getBalance',
  'getLatestBlockhash',
  'getParsedTokenAccountsByOwner',
  'getSignatureStatuses',
  'getTokenAccountBalance',
  'getMinimumBalanceForRentExemption',
]);

const json = (status: number, body: unknown) => Response.json(body, { status });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST uniquement' });

  const payload = await req.json().catch(() => null);
  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length === 0 || calls.length > 10) return json(400, { error: 'Requête JSON-RPC invalide' });
  for (const call of calls) {
    if (!call || typeof call.method !== 'string' || !ALLOWED_METHODS.has(call.method)) {
      return json(400, { error: `Méthode non autorisée : ${call?.method}` });
    }
  }

  // Le RPC public de devnet limite le nombre d'appels (429) : on réessaie un peu
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      continue;
    }
    return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }
  return json(503, { error: 'RPC Solana saturé, réessaie dans un instant' });
});
