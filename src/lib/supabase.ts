import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquants dans .env.local');
}

// Pas de comptes utilisateurs Supabase : l'identité, c'est le wallet. On ne stocke donc aucune session.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
