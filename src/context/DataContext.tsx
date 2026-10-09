import { Buffer } from 'buffer';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { computeSupport, SupportRelation } from '../data/streaks';
import { useWallet } from './WalletContext';

export type Creator = {
  id: string;
  handle: string; // slug public du lien profond : tipstreak://<handle>
  name: string;
  initial: string;
  category: string;
  bio: string;
  walletAddress: string;
  avatarUrl: string | null; // photo de profil (Supabase Storage), sinon initiale
  supporters: number;
  totalReceived: number;
};

export type Tip = {
  signature: string;
  creatorId: string;
  creatorName: string;
  amount: number;
  boosted: boolean;
  message: string | null;
  createdAt: Date;
};

type DataContextType = {
  creators: Creator[];
  myTips: Tip[]; // tips envoyés par le wallet connecté, du plus récent au plus ancien
  mySupport: SupportRelation[];
  loading: boolean;
  error: string | null; // clé de traduction
  refresh: () => Promise<void>;
  getCreator: (id: string) => Creator | undefined;
  getCreatorByHandle: (handle: string) => Creator | undefined;
  getSupportRelation: (creatorId: string) => SupportRelation | undefined;
  recordTip: (params: { signature: string; creatorId: string }) => Promise<void>;
  myCreator: Creator | undefined; // page créateur du wallet connecté, s'il en a publié une
  publishCreator: (profile: CreatorProfileInput) => Promise<Creator>;
  uploadAvatar: (jpegBase64: string) => Promise<void>; // photo JPEG 512 × 512 déjà préparée
};

export type CreatorProfileInput = { handle: string; name: string; category: string; bio: string };

// ⚠️ Doit produire exactement le même texte que buildMessage() dans
// supabase/functions/register-creator/index.ts, sinon la signature sera refusée
function buildCreatorMessage(p: CreatorProfileInput & { wallet: string; issuedAt: string }): string {
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

// ⚠️ Doit produire exactement le même texte que buildMessage() dans supabase/functions/upload-avatar/index.ts
function buildAvatarMessage(wallet: string, sha256: string, issuedAt: string): string {
  return ['TipStreak : changer ma photo de profil', `Wallet : ${wallet}`, `Image : ${sha256}`, `Date : ${issuedAt}`].join('\n');
}

// Les Edge Functions renvoient { error: "..." } : on remonte ce message lisible plutôt que le code HTTP
async function invokeFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error ?? message;
    } catch {}
    throw new Error(message);
  }
  return data as T;
}

const DataContext = createContext<DataContextType | null>(null);

type CreatorRow = {
  id: string;
  handle: string;
  name: string;
  category: string;
  bio: string;
  wallet_address: string;
  avatar_url: string | null;
  supporters: number;
  total_received: number;
};

type TipRow = {
  signature: string;
  creator_id: string;
  amount: number;
  boosted: boolean;
  message: string | null;
  created_at: string;
};

function toCreator(row: CreatorRow): Creator {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    initial: row.name.charAt(0).toUpperCase(),
    category: row.category,
    bio: row.bio,
    walletAddress: row.wallet_address,
    avatarUrl: row.avatar_url ?? null,
    supporters: row.supporters,
    totalReceived: Number(row.total_received),
  };
}

type LoadResult = { ok: true; creators: Creator[]; tipRows: TipRow[] } | { ok: false };

// Créateurs (avec stats) + tips envoyés par le wallet connecté
async function loadData(publicKey: string | null): Promise<LoadResult> {
  try {
    const creatorsQuery = supabase.from('creator_stats').select('*').order('supporters', { ascending: false });
    const tipsQuery = publicKey
      ? supabase
          .from('tips')
          .select('signature, creator_id, amount, boosted, message, created_at')
          .eq('fan_wallet', publicKey)
          .order('created_at', { ascending: false })
      : null;

    const [creatorsRes, tipsRes] = await Promise.all([creatorsQuery, tipsQuery]);
    if (creatorsRes.error) throw creatorsRes.error;
    if (tipsRes?.error) throw tipsRes.error;

    return {
      ok: true,
      creators: (creatorsRes.data as CreatorRow[]).map(toCreator),
      tipRows: (tipsRes?.data as TipRow[] | undefined) ?? [],
    };
  } catch (e) {
    console.error('Supabase fetch error', e);
    return { ok: false };
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [tipRows, setTipRows] = useState<TipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback((result: LoadResult) => {
    if (result.ok) {
      setCreators(result.creators);
      setTipRows(result.tipRows);
      setError(null);
    } else {
      setError('discover.loadError');
    }
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    applyResult(await loadData(publicKey));
  }, [publicKey, applyResult]);

  // Recharge au démarrage et à chaque connexion / déconnexion du wallet.
  // Une réponse arrivée après un changement de wallet est ignorée.
  useEffect(() => {
    let cancelled = false;
    loadData(publicKey).then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey, applyResult]);

  const recordTip = useCallback<DataContextType['recordTip']>(
    async ({ signature, creatorId }) => {
      // L'Edge Function relit la transaction on-chain (boost SKR compris) avant d'enregistrer quoi que ce soit
      await invokeFunction('record-tip', { signature, creatorId });
      await refresh();
    },
    [refresh]
  );

  const publishCreator = useCallback<DataContextType['publishCreator']>(
    async (input) => {
      if (!publicKey) throw new Error('error.connectToPublish');

      // Mêmes nettoyages que côté serveur, pour que le message signé soit identique
      const profile = {
        wallet: publicKey,
        handle: input.handle.trim().toLowerCase(),
        name: input.name.trim(),
        category: input.category.trim(),
        bio: input.bio.trim(),
        issuedAt: new Date().toISOString(),
      };
      const signedPayload = await signMessage(buildCreatorMessage(profile));

      const row = await invokeFunction<CreatorRow>('register-creator', {
        ...profile,
        signedPayload: Buffer.from(signedPayload).toString('base64'),
      });
      await refresh();
      return toCreator({ ...row, supporters: 0, total_received: 0 });
    },
    [publicKey, signMessage, refresh]
  );

  // La signature porte sur l'empreinte de l'image : elle ne peut pas servir pour une autre photo
  const uploadAvatar = useCallback<DataContextType['uploadAvatar']>(
    async (jpegBase64) => {
      if (!publicKey) throw new Error('error.connectToPublish');
      const issuedAt = new Date().toISOString();
      // Module natif chargé à la demande : une development build plus ancienne démarre quand même
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Crypto = require('expo-crypto') as typeof import('expo-crypto');
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, jpegBase64, {
        encoding: Crypto.CryptoEncoding.HEX,
      });
      const signedPayload = await signMessage(buildAvatarMessage(publicKey, sha256, issuedAt));
      await invokeFunction('upload-avatar', {
        wallet: publicKey,
        issuedAt,
        imageBase64: jpegBase64,
        signedPayload: Buffer.from(signedPayload).toString('base64'),
      });
      await refresh();
    },
    [publicKey, signMessage, refresh]
  );

  const value = useMemo<DataContextType>(() => {
    const byId = new Map(creators.map((c) => [c.id, c]));
    const myTips: Tip[] = tipRows.map((t) => ({
      signature: t.signature,
      creatorId: t.creator_id,
      creatorName: byId.get(t.creator_id)?.name ?? 'Créateur',
      amount: Number(t.amount),
      boosted: t.boosted,
      message: t.message,
      createdAt: new Date(t.created_at),
    }));
    const mySupport = computeSupport(tipRows.map((t) => ({ ...t, amount: Number(t.amount) })));

    return {
      creators,
      myTips,
      mySupport,
      loading,
      error,
      refresh,
      getCreator: (id) => byId.get(id),
      getCreatorByHandle: (handle) => creators.find((c) => c.handle === handle.toLowerCase()),
      getSupportRelation: (creatorId) => mySupport.find((s) => s.creatorId === creatorId),
      recordTip,
      myCreator: publicKey ? creators.find((c) => c.walletAddress === publicKey) : undefined,
      publishCreator,
      uploadAvatar,
    };
  }, [creators, tipRows, loading, error, refresh, recordTip, publicKey, publishCreator, uploadAvatar]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>');
  return ctx;
}

export function getCreatorLink(creator: Creator): string {
  return `tipstreak://${creator.handle}`;
}
