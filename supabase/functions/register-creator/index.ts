// Edge Function register-creator : publie ou met à jour la page d'un créateur.
//
// Le créateur signe un message avec son wallet (gratuit, aucune transaction).
// On vérifie cette signature avant d'écrire : personne ne peut créer une page
// avec le wallet de quelqu'un d'autre pour détourner ses tips.
// Un wallet = une page. Republier avec le même wallet met la page à jour.

import { createClient } from 'npm:@supabase/supabase-js@2';
import nacl from 'npm:tweetnacl@1';
import bs58 from 'npm:bs58@6';

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000; // une signature n'est valable que 10 minutes
const HANDLE = /^[a-z0-9_]{3,30}$/;
const RESERVED_HANDLES = ['soutiens', 'historique', 'profil']; // chemins des onglets (liens profonds)

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

type Profile = { wallet: string; handle: string; name: string; category: string; bio: string; issuedAt: string };

// ⚠️ Doit produire exactement le même texte que buildCreatorMessage() dans src/context/DataContext.tsx
function buildMessage(p: Profile): string {
  return [
    'TipStreak : publier ma page créateur',
    `Wallet : ${p.wallet}`,
    `Handle : ${p.handle}`,
    `Nom : ${p.name}`,
    `Catégorie : ${p.category}`,
    `Bio : ${p.bio}`,
    `Date : ${p.issuedAt}`,
  ].join('\n');
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
}

// Selon le wallet, Mobile Wallet Adapter renvoie la signature seule (64 octets),
// ou le message suivi / précédé de la signature.
function extractSignature(signed: Uint8Array, message: Uint8Array): Uint8Array {
  if (signed.length === nacl.sign.signatureLength) return signed;
  if (signed.length === message.length + nacl.sign.signatureLength) {
    if (startsWith(signed, message)) return signed.slice(message.length);
    return signed.slice(0, nacl.sign.signatureLength);
  }
  throw new HttpError(400, 'Signature illisible');
}

function readString(body: Record<string, unknown>, key: string, max: number, min = 1): string {
  const value = body[key];
  if (typeof value !== 'string') throw new HttpError(400, `${key} manquant`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new HttpError(400, `${key} : entre ${min} et ${max} caractères`);
  return trimmed;
}

const json = (status: number, body: unknown) => Response.json(body, { status });

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST uniquement');
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Corps de requête invalide');

    // L'app signe les valeurs déjà nettoyées (espaces retirés, handle en minuscules) :
    // le même nettoyage ici redonne exactement le message signé
    const profile: Profile = {
      wallet: readString(body, 'wallet', 50, 32),
      handle: readString(body, 'handle', 30, 3).toLowerCase(),
      name: readString(body, 'name', 50),
      category: readString(body, 'category', 50),
      bio: readString(body, 'bio', 280, 0),
      issuedAt: readString(body, 'issuedAt', 40),
    };
    if (typeof body.signedPayload !== 'string') throw new HttpError(400, 'signedPayload manquant');

    if (!HANDLE.test(profile.handle)) {
      throw new HttpError(400, 'Handle : 3 à 30 caractères, lettres minuscules, chiffres ou _');
    }
    if (RESERVED_HANDLES.includes(profile.handle)) throw new HttpError(400, 'Ce handle est réservé');

    const age = Date.now() - Date.parse(profile.issuedAt);
    if (Number.isNaN(age) || age > MAX_MESSAGE_AGE_MS || age < -60_000) {
      throw new HttpError(400, 'Signature expirée, recommence');
    }

    let publicKey: Uint8Array;
    try {
      publicKey = bs58.decode(profile.wallet);
    } catch {
      throw new HttpError(400, 'Adresse de wallet invalide');
    }
    if (publicKey.length !== nacl.sign.publicKeyLength) throw new HttpError(400, 'Adresse de wallet invalide');

    const message = new TextEncoder().encode(buildMessage(profile));
    const signature = extractSignature(base64ToBytes(body.signedPayload), message);
    if (!nacl.sign.detached.verify(message, signature, publicKey)) {
      throw new HttpError(401, 'Signature invalide : ce wallet ne correspond pas');
    }

    const fields = { handle: profile.handle, name: profile.name, category: profile.category, bio: profile.bio };
    const { data: existing, error: lookupError } = await supabase
      .from('creators')
      .select('id')
      .eq('wallet_address', profile.wallet)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const { data, error } = existing
      ? await supabase.from('creators').update(fields).eq('id', existing.id).select().single()
      : await supabase.from('creators').insert({ ...fields, wallet_address: profile.wallet }).select().single();

    if (error?.code === '23505') throw new HttpError(409, 'Ce handle est déjà pris, choisis-en un autre');
    if (error?.code === '23514') throw new HttpError(400, 'Un des champs ne respecte pas le format attendu');
    if (error) throw error;

    return json(existing ? 200 : 201, data);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error('register-creator', e);
    return json(500, { error: 'Erreur interne' });
  }
});
