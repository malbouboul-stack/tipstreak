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
  recordTip: (params: { signature: string; creatorId: string; boostSignature?: string | null }) => Promise<void>;
  myCreator: Creator | undefined; // page créateur du wallet connecté, s'il en a publié une
  publishCreator: (profile: CreatorProfileInput) => Promise<Creator>;
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
    supporters: row.supporters,
    totalReceived: Number(row.total_received),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [tipRows, setTipRows] = useState<TipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
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

      setCreators((creatorsRes.data as CreatorRow[]).map(toCreator));
      setTipRows((tipsRes?.data as TipRow[] | undefined) ?? []);
    } catch (e: any) {
      console.error('Supabase fetch error', e);
      setError('discover.loadError');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Recharge au démarrage et à chaque connexion / déconnexion du wallet
  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordTip = useCallback<DataContextType['recordTip']>(
    async ({ signature, creatorId, boostSignature }) => {
      // L'Edge Function relit la transaction on-chain avant d'enregistrer quoi que ce soit
      await invokeFunction('record-tip', { signature, creatorId, boostSignature: boostSignature ?? null });
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
    };
  }, [creators, tipRows, loading, error, refresh, recordTip, publicKey, publishCreator]);

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
