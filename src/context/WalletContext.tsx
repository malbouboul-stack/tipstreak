import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { Buffer } from 'buffer';
import { fetchWithRetry } from '../lib/network';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, TransactionInstruction, clusterApiUrl } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from '@solana/spl-token';
import { SKR_MINT_ADDRESS, SKR_DECIMALS, PLATFORM_WALLET_ADDRESS } from '../constants/skr';

// Adresse officielle du token USDC sur Solana devnet (différente du mainnet)
const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_DECIMALS = 6;
// Programme Memo : le message du fan est signé dans la transaction, l'Edge Function
// record-tip le relit on-chain (impossible de l'attacher après coup à un tip qui n'est pas le sien)
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
// Relais du RPC via Supabase (Edge Function solana-rpc), pour les réseaux qui n'arrivent pas
// à résoudre api.devnet.solana.com. En cas d'erreur réseau, chaque requête alterne entre le RPC
// direct et le relais, avec quelques nouvelles tentatives (cf. src/lib/network.ts).
const RPC_RELAY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/solana-rpc`;
const fetchWithRelay: typeof fetch = (input, init) => fetchWithRetry(input, init, RPC_RELAY_URL);

const connection = new Connection(clusterApiUrl('devnet'), { commitment: 'confirmed', fetch: fetchWithRelay });

// Attend que la transaction soit confirmée. Sans ça, le solde affiché et l'Edge Function
// record-tip peuvent encore voir l'état d'avant l'envoi.
async function waitForConfirmation(signature: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error('error.txFailed');
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('error.txNotConfirmed');
}

// Les erreurs levées ici portent une clé de traduction (src/i18n/translations.ts) :
// les écrans les affichent dans la langue choisie via translateError().

type WalletContextType = {
  publicKey: string | null;
  connecting: boolean;
  error: string | null; // clé de traduction
  solBalance: number | null;
  usdcBalance: number | null;
  refreshingBalances: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
  sendTip: (recipientAddress: string, amountUsdc: number, message?: string) => Promise<string>;
  sendBoost: (amountSkr: number) => Promise<string>;
  signMessage: (message: string) => Promise<Uint8Array>;
};

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  connecting: false,
  error: null,
  solBalance: null,
  usdcBalance: null,
  refreshingBalances: false,
  connect: async () => {},
  disconnect: () => {},
  refreshBalances: async () => {},
  sendTip: async () => '',
  sendBoost: async () => '',
  signMessage: async () => new Uint8Array(),
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [refreshingBalances, setRefreshingBalances] = useState(false);

  // SOL et USDC sont chargés séparément : si l'un échoue, l'autre s'affiche quand même.
  // En cas d'échec, on garde l'ancienne valeur plutôt que de l'effacer.
  const refreshBalances = useCallback(
    async (address?: string) => {
      const target = address ?? publicKey;
      if (!target) return;
      setRefreshingBalances(true);
      const owner = new PublicKey(target);
      const [sol, usdc] = await Promise.allSettled([
        connection.getBalance(owner),
        connection.getParsedTokenAccountsByOwner(owner, { mint: DEVNET_USDC_MINT }),
      ]);
      if (sol.status === 'fulfilled') setSolBalance(sol.value / LAMPORTS_PER_SOL);
      if (usdc.status === 'fulfilled') {
        const account = usdc.value.value[0];
        setUsdcBalance(account ? (account.account.data.parsed.info.tokenAmount.uiAmount ?? 0) : 0);
      }
      if (sol.status === 'rejected' || usdc.status === 'rejected') {
        console.warn('Solde partiellement indisponible (réseau)', sol.status, usdc.status);
      }
      setRefreshingBalances(false);
    },
    [publicKey]
  );

  // Soldes rechargés à chaque retour dans l'app (après Phantom, après une mise en veille…)
  useEffect(() => {
    if (!publicKey) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBalances(publicKey);
    });
    return () => subscription.remove();
  }, [publicKey, refreshBalances]);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          cluster: 'devnet',
          identity: {
            name: 'TipStreak',
            uri: 'https://tipstreak.app',
            icon: 'favicon.ico',
          },
        });
        return new PublicKey(Buffer.from(authResult.accounts[0].address, 'base64')).toBase58();
      });
      setPublicKey(address);
      // Une fois revenu dans l'app (Phantom fermé) : le réseau est alors pleinement disponible
      await refreshBalances(address);
    } catch (e: any) {
      console.error('Wallet connect error', e);
      setError(e?.message?.includes('No wallet') ? 'error.noWalletApp' : 'error.connectFailed');
    } finally {
      setConnecting(false);
    }
  };

  const sendTip = async (recipientAddress: string, amountUsdc: number, message?: string): Promise<string> => {
    if (!publicKey) throw new Error('error.walletNotConnected');

    let signature = '';

    await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: {
          name: 'TipStreak',
          uri: 'https://tipstreak.app',
          icon: 'favicon.ico',
        },
      });

      const senderPubkey = new PublicKey(Buffer.from(authResult.accounts[0].address, 'base64'));
      const recipientPubkey = new PublicKey(recipientAddress);

      const senderAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, senderPubkey);
      const recipientAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, recipientPubkey);

      const instructions = [];

      // Si le créateur n'a jamais reçu d'USDC, son "compte token" n'existe pas encore
      // sur la chaîne : on doit le créer dans la même transaction (le fan paie ces
      // quelques centimes de frais de réseau, comme pour un vrai virement).
      const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
      if (!recipientAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(senderPubkey, recipientAta, recipientPubkey, DEVNET_USDC_MINT)
        );
      }

      instructions.push(
        createTransferCheckedInstruction(
          senderAta,
          DEVNET_USDC_MINT,
          recipientAta,
          senderPubkey,
          Math.round(amountUsdc * 10 ** USDC_DECIMALS),
          USDC_DECIMALS
        )
      );

      const memo = message?.trim();
      if (memo) {
        instructions.push(
          new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, 'utf-8') })
        );
      }

      const latestBlockhash = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        feePayer: senderPubkey,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }).add(...instructions);

      const signatures = await wallet.signAndSendTransactions({ transactions: [transaction] });
      signature = signatures[0];
    });

    await waitForConfirmation(signature);
    return signature;
  };

  const sendBoost = async (amountSkr: number): Promise<string> => {
    if (!publicKey) throw new Error('error.walletNotConnected');

    let signature = '';
    const skrMint = new PublicKey(SKR_MINT_ADDRESS);

    await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: {
          name: 'TipStreak',
          uri: 'https://tipstreak.app',
          icon: 'favicon.ico',
        },
      });

      const senderPubkey = new PublicKey(Buffer.from(authResult.accounts[0].address, 'base64'));
      const platformPubkey = new PublicKey(PLATFORM_WALLET_ADDRESS);

      const senderAta = await getAssociatedTokenAddress(skrMint, senderPubkey);
      const platformAta = await getAssociatedTokenAddress(skrMint, platformPubkey);

      const instructions = [];

      const platformAtaInfo = await connection.getAccountInfo(platformAta);
      if (!platformAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(senderPubkey, platformAta, platformPubkey, skrMint)
        );
      }

      instructions.push(
        createTransferCheckedInstruction(
          senderAta,
          skrMint,
          platformAta,
          senderPubkey,
          Math.round(amountSkr * 10 ** SKR_DECIMALS),
          SKR_DECIMALS
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      const transaction = new Transaction({
        feePayer: senderPubkey,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }).add(...instructions);

      const signatures = await wallet.signAndSendTransactions({ transactions: [transaction] });
      signature = signatures[0];
    });

    await waitForConfirmation(signature);
    return signature;
  };

  // Signature d'un simple message (gratuit, aucune transaction) : prouve qu'on possède le wallet.
  // Renvoie la charge signée telle que le wallet la fournit ; le serveur en extrait la signature.
  const signMessage = async (message: string): Promise<Uint8Array> => {
    if (!publicKey) throw new Error('error.walletNotConnected');

    return transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: 'devnet',
        identity: {
          name: 'TipStreak',
          uri: 'https://tipstreak.app',
          icon: 'favicon.ico',
        },
      });

      const account = authResult.accounts[0];
      if (new PublicKey(Buffer.from(account.address, 'base64')).toBase58() !== publicKey) {
        throw new Error('error.walletChanged');
      }

      const [signedPayload] = await wallet.signMessages({
        addresses: [account.address],
        payloads: [Buffer.from(message, 'utf-8')],
      });
      return signedPayload;
    });
  };

  const disconnect = () => {
    setPublicKey(null);
    setSolBalance(null);
    setUsdcBalance(null);
  };

  return (
    <WalletContext.Provider
      value={{ publicKey, connecting, error, solBalance, usdcBalance, refreshingBalances, connect, disconnect, refreshBalances, sendTip, sendBoost, signMessage }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
