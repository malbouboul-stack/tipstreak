// Edge Function upload-avatar : enregistre la photo de profil d'un créateur.
//
// L'app envoie l'image (JPEG 512 × 512, en base64) et un message signé par le wallet du créateur,
// qui contient l'empreinte SHA-256 de l'image. On vérifie la signature et l'empreinte avant d'écrire :
// personne ne peut changer la photo d'un autre créateur, ni réutiliser une signature pour une autre image.

import { createClient } from 'npm:@supabase/supabase-js@2';
import nacl from 'npm:tweetnacl@1';
import bs58 from 'npm:bs58@6';

const MAX_MESSAGE_AGE_MS = 10 * 60 * 1000; // une signature n'est valable que 10 minutes
const MAX_IMAGE_BYTES = 512 * 1024; // même limite que le bucket "avatars"
const BUCKET = 'avatars';

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

// ⚠️ Doit produire exactement le même texte que buildAvatarMessage() dans src/context/DataContext.tsx
function buildMessage(wallet: string, sha256: string, issuedAt: string): string {
  return ['TipStreak : changer ma photo de profil', `Wallet : ${wallet}`, `Image : ${sha256}`, `Date : ${issuedAt}`].join('\n');
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
}

// Selon le wallet, Mobile Wallet Adapter renvoie la signature seule (64 octets),
// ou le message suivi / précédé de la signature (cf. register-creator).
function extractSignature(signed: Uint8Array, message: Uint8Array): Uint8Array {
  if (signed.length === nacl.sign.signatureLength) return signed;
  if (signed.length === message.length + nacl.sign.signatureLength) {
    if (startsWith(signed, message)) return signed.slice(message.length);
    return signed.slice(0, nacl.sign.signatureLength);
  }
  throw new HttpError(400, 'Signature illisible');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const json = (status: number, body: unknown) => Response.json(body, { status });

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST uniquement');
    const body = await req.json().catch(() => null);
    const { wallet, issuedAt, imageBase64, signedPayload } = body ?? {};
    if (typeof wallet !== 'string' || typeof issuedAt !== 'string') throw new HttpError(400, 'wallet ou issuedAt manquant');
    if (typeof imageBase64 !== 'string' || typeof signedPayload !== 'string') throw new HttpError(400, 'image ou signature manquante');

    const age = Date.now() - Date.parse(issuedAt);
    if (Number.isNaN(age) || age > MAX_MESSAGE_AGE_MS || age < -60_000) throw new HttpError(400, 'Signature expirée, recommence');

    const image = base64ToBytes(imageBase64);
    if (image.length > MAX_IMAGE_BYTES) throw new HttpError(400, 'Image trop lourde (500 Ko max)');
    // Signature de fichier JPEG (FF D8 FF) : on n'accepte rien d'autre dans le bucket
    if (!(image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff)) throw new HttpError(400, "Format d'image non pris en charge");

    let publicKey: Uint8Array;
    try {
      publicKey = bs58.decode(wallet);
    } catch {
      throw new HttpError(400, 'Adresse de wallet invalide');
    }
    if (publicKey.length !== nacl.sign.publicKeyLength) throw new HttpError(400, 'Adresse de wallet invalide');

    // L'empreinte est recalculée ici : la signature ne vaut que pour cette image précise
    const message = new TextEncoder().encode(buildMessage(wallet, await sha256Hex(imageBase64), issuedAt));
    const signature = extractSignature(base64ToBytes(signedPayload), message);
    if (!nacl.sign.detached.verify(message, signature, publicKey)) {
      throw new HttpError(401, 'Signature invalide : ce wallet ne correspond pas');
    }

    const { data: creator, error: lookupError } = await supabase
      .from('creators')
      .select('id, avatar_url')
      .eq('wallet_address', wallet)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!creator) throw new HttpError(404, 'Aucune page créateur pour ce wallet');

    // Nouveau nom à chaque fois : les téléphones ne gardent pas l'ancienne image en cache
    const path = `${creator.id}/${Date.now()}.jpg`;
    const upload = await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' });
    if (upload.error) throw upload.error;
    const avatarUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const { error } = await supabase.from('creators').update({ avatar_url: avatarUrl }).eq('id', creator.id);
    if (error) throw error;

    // L'ancienne photo ne sert plus
    const previous = creator.avatar_url?.split(`/${BUCKET}/`)[1];
    if (previous) await supabase.storage.from(BUCKET).remove([previous]);

    return json(200, { avatarUrl });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    console.error('upload-avatar', e);
    return json(500, { error: 'Erreur interne' });
  }
});
