import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export type CreatorTip = {
  signature: string;
  fanWallet: string;
  amount: number;
  boosted: boolean;
  message: string | null;
  createdAt: Date;
};

const MAX_TIPS = 50;

// Tips reçus par un créateur (publics, comme sur la blockchain), du plus récent au plus ancien.
// Rechargés à chaque fois que l'écran revient au premier plan, par exemple après l'envoi d'un tip.
export function useCreatorTips(creatorId: string | undefined) {
  const [tips, setTips] = useState<CreatorTip[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!creatorId) return;
    const { data, error } = await supabase
      .from('tips')
      .select('signature, fan_wallet, amount, boosted, message, created_at')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(MAX_TIPS);

    if (error) {
      console.error('Creator tips fetch error', error);
    } else {
      setTips(
        data.map((t) => ({
          signature: t.signature,
          fanWallet: t.fan_wallet,
          amount: Number(t.amount),
          boosted: t.boosted,
          message: t.message,
          createdAt: new Date(t.created_at),
        }))
      );
    }
    setLoading(false);
  }, [creatorId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { tips, loading, reload };
}
