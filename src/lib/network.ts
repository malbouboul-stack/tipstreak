// Requêtes réseau tolérantes aux ratés : sur certains Wi-Fi, la résolution DNS échoue par
// intermittence ("Unable to resolve host"), une requête passe et la suivante non.
// On ne réessaie que les erreurs réseau (fetch qui lève une exception), jamais une réponse HTTP
// d'erreur : dans ce cas le serveur a bien répondu.

const RETRY_DELAYS_MS = [0, 400, 1000, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FetchInput = Parameters<typeof fetch>[0];

// Essaie l'adresse principale, puis éventuellement une adresse de secours, en alternance,
// avec un délai croissant entre les tentatives.
// L'entrée accepte aussi un URL : les librairies (web3.js, supabase-js) sont typées avec le fetch
// du navigateur, un peu plus large que celui de React Native.
export async function fetchWithRetry(
  input: FetchInput | URL,
  init?: RequestInit,
  fallbackUrl?: string
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt]) await sleep(RETRY_DELAYS_MS[attempt]);
    const target = fallbackUrl && attempt % 2 === 1 ? fallbackUrl : input;
    try {
      return await fetch(typeof target === 'string' || !(target instanceof URL) ? target : target.toString(), init);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
