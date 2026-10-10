// Requêtes réseau tolérantes aux ratés : sur certains Wi-Fi, la résolution DNS échoue par
// intermittence ("Unable to resolve host"), une requête passe et la suivante non.
// On réessaie les erreurs réseau (fetch qui lève une exception) et les serveurs saturés ou en panne
// (HTTP 429 "rate limit", 5xx) : le RPC public de devnet refuse les appels quand il est très sollicité.
// Les autres réponses HTTP sont renvoyées telles quelles : le serveur a bien répondu.

const RETRY_DELAYS_MS = [0, 400, 1000, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isOverloaded = (status: number) => status === 429 || status >= 500;

type FetchInput = Parameters<typeof fetch>[0];

// Essaie l'adresse principale, puis éventuellement une adresse de secours (le relais Supabase), en
// alternance, avec un délai croissant entre les tentatives.
// L'entrée accepte aussi un URL : les librairies (web3.js, supabase-js) sont typées avec le fetch
// du navigateur, un peu plus large que celui de React Native.
export async function fetchWithRetry(
  input: FetchInput | URL,
  init?: RequestInit,
  fallbackUrl?: string
): Promise<Response> {
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt]) await sleep(RETRY_DELAYS_MS[attempt]);
    const target = fallbackUrl && attempt % 2 === 1 ? fallbackUrl : input;
    try {
      const response = await fetch(typeof target === 'string' || !(target instanceof URL) ? target : target.toString(), init);
      if (!isOverloaded(response.status)) return response;
      lastResponse = response; // saturé : on tente l'adresse suivante
    } catch (e) {
      lastError = e;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}
