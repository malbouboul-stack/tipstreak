import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { fetchWithRetry } from './network';

// La clé "publishable" est faite pour être embarquée dans l'app (ce n'est pas un secret) :
// la Row Level Security ne lui donne qu'un accès en lecture. Toutes les écritures passent par
// les Edge Functions, qui vérifient une preuve on-chain ou une signature de wallet (cf. SECURITY.md).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquants dans .env.local');
}

// Pas de comptes utilisateurs Supabase : l'identité, c'est le wallet. On ne stocke donc aucune session.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  // Nouvelles tentatives sur les ratés réseau (DNS intermittent sur certains Wi-Fi)
  global: { fetch: (input, init) => fetchWithRetry(input, init) },
});
