import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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
import { SKR_MINT_ADDRESS, SKR_DECIMALS } from '../constants/skr';
import { TREASURY_WALLET_ADDRESS } from '../constants/platform';

// Adresse officielle du token USDC sur Solana devnet (différente du mainnet)
const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const USDC_DECIMALS = 6;
const SKR_MINT = new PublicKey(SKR_MINT_ADDRESS);
const TREASURY = new PublicKey(TREASURY_WALLET_ADDRESS);
// Programme Memo : le message du fan est signé dans la transaction, l'Edge Function
// record-tip le relit on-chain (impossible de l'attacher après coup à un tip qui n'est pas le sien)
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
// Relais du RPC via Supabase (Edge Function solana-rpc), pour les réseaux qui n'arrivent pas
// à résoudre api.devnet.solana.com. En cas d'erreur réseau, chaque requête alterne entre le RPC
// direct et le relais, avec quelques nouvelles tentatives (cf. src/lib/network.ts).
const RPC_RELAY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/solana-rpc`;
const fetchWithRelay: typeof fetch = (input, init) => fetchWithRetry(input, init, RPC_RELAY_URL);

const connection = new Connection(clusterApiUrl('devnet'), { commitment: 'confirmed', fetch: fetchWithRelay });

// Identité présentée à Phantom lors de la demande d'autorisation
const APP_IDENTITY = { name: 'TipStreak', uri: 'https://tipstreak.app', icon: 'favicon.ico' };

// Envoie une transaction signée (APRÈS le retour du wallet) et attend sa confirmation. Sans attendre,
// le solde affiché et l'Edge Function record-tip pourraient encore voir l'état d'avant l'envoi.
// - Pas de simulation préalable (skipPreflight) : sur devnet, le nœud qui simule est parfois en retard et
//   répond "Blockhash not found" pour une transaction valide. Les vraies erreurs restent vues (status.err).
// - Renvoyée régulièrement tant qu'elle n'est pas confirmée : sans risque, Solana ne l'exécute qu'une fois.
// - Requêtes espacées (le RPC public limite les appels) ; une requête refusée n'interrompt pas le suivi,
//   et fetchWithRetry bascule sur le relais Supabase si le RPC public répond "429 saturé".
async function sendAndConfirm(raw: Buffer, lastValidBlockHeight: number | undefined, timeoutMs = 90000): Promise<string> {
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const send = () => connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });

  let signature: string | null = null;
  for (let attempt = 0; attempt < 4 && !signature; attempt++) {
    try {
      signature = await send();
    } catch (e) {
      if (attempt === 3) throw e;
      await pause(1500 * (attempt + 1));
    }
  }
  const deadline = Date.now() + timeoutMs;
  let lastSend = Date.now();
  let lastHeightCheck = 0;
  while (Date.now() < deadline) {
    try {
      const status = (await connection.getSignatureStatuses([signature!])).value[0];
      if (status?.err) throw new Error('error.txFailed');
      if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return signature!;
    } catch (e: any) {
      if (e?.message === 'error.txFailed') throw e;
    }
    if (lastValidBlockHeight !== undefined && Date.now() - lastHeightCheck > 4000) {
      lastHeightCheck = Date.now();
      const height = await connection.getBlockHeight('confirmed').catch(() => null);
      if (height !== null && height > lastValidBlockHeight) {
        // Expirée ET jamais exécutée : rien n'a été débité
        const last = (await connection.getSignatureStatuses([signature!], { searchTransactionHistory: true })).value[0];
        if (last?.err) throw new Error('error.txFailed');
        if (last?.confirmationStatus === 'confirmed' || last?.confirmationStatus === 'finalized') return signature!;
        throw new Error('error.txExpired');
      }
    }
    if (Date.now() - lastSend > 3000) {
      lastSend = Date.now();
      send().catch(() => {});
    }
    await pause(1000);
  }
  throw new Error('error.txNotConfirmed');
}

type SplTransfer = { mint: PublicKey; decimals: number; recipient: PublicKey; amount: number };
export type TipOptions = { message?: string; boostSkr?: number; contributionUsdc?: number };

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
  sendTip: (recipientAddress: string, amountUsdc: number, options?: TipOptions) => Promise<string>;
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

  // Autorisation Phantom mémorisée pour la session : les tips suivants ne redemandent pas "Connecter"
  const authTokenRef = useRef<string | null>(null);

  // (Ré)autorise l'app dans une session wallet ouverte. Si l'autorisation mémorisée n'est plus
  // valable (révoquée dans Phantom…), on redemande une autorisation normale.
  const authorize = async (wallet: Web3MobileWallet): Promise<string> => {
    let result;
    try {
      result = await wallet.authorize({
        chain: 'solana:devnet',
        identity: APP_IDENTITY,
        auth_token: authTokenRef.current ?? undefined,
      });
    } catch (e) {
      if (!authTokenRef.current) throw e;
      authTokenRef.current = null;
      result = await wallet.authorize({ chain: 'solana:devnet', identity: APP_IDENTITY });
    }
    authTokenRef.current = result.auth_token;
    return new PublicKey(Buffer.from(result.accounts[0].address, 'base64')).toBase58();
  };

  // Prépare la transaction AVANT d'ouvrir le wallet : toutes les requêtes réseau sont faites ici.
  // Une fois Phantom ouvert, l'app passe en arrière-plan : si elle devait encore attendre le réseau,
  // Phantom fermerait la session ("Cannot send in CLOSED").
  // Plusieurs transferts SPL (tip USDC + boost SKR) tiennent dans une seule transaction :
  // une seule signature dans le wallet, et tout passe ou rien ne passe.
  const buildTransaction = async (transfers: SplTransfer[], memo?: string): Promise<Transaction> => {
    if (!publicKey) throw new Error('error.walletNotConnected');
    const sender = new PublicKey(publicKey);
    const accounts = await Promise.all(
      transfers.map(async (transfer) => ({
        transfer,
        senderAta: await getAssociatedTokenAddress(transfer.mint, sender),
        recipientAta: await getAssociatedTokenAddress(transfer.mint, transfer.recipient),
      }))
    );

    const [recipientAtaInfos, latestBlockhash] = await Promise.all([
      Promise.all(accounts.map(({ recipientAta }) => connection.getAccountInfo(recipientAta))),
      // "finalized" : un peu plus ancien, déjà connu de tous les nœuds (dont celui du wallet)
      connection.getLatestBlockhash('finalized'),
    ]);

    const instructions: TransactionInstruction[] = [];
    accounts.forEach(({ transfer, senderAta, recipientAta }, i) => {
      // Si le destinataire n'a jamais reçu ce jeton, son "compte token" n'existe pas encore :
      // on le crée dans la même transaction (le fan paie ces quelques centimes de frais).
      if (!recipientAtaInfos[i]) {
        instructions.push(createAssociatedTokenAccountInstruction(sender, recipientAta, transfer.recipient, transfer.mint));
      }
      instructions.push(
        createTransferCheckedInstruction(
          senderAta,
          transfer.mint,
          recipientAta,
          sender,
          Math.round(transfer.amount * 10 ** transfer.decimals),
          transfer.decimals
        )
      );
    });
    const text = memo?.trim();
    if (text) {
      instructions.push(new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(text, 'utf-8') }));
    }

    return new Transaction({
      feePayer: sender,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }).add(...instructions);
  };

  // Solde SKR du fan, vérifié avant d'ouvrir le wallet : sans assez de SKR, toute la transaction échouerait
  const checkSkrBalance = async (owner: PublicKey, amountSkr: number) => {
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint: SKR_MINT });
    const balance = accounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
    if (balance < amountSkr) throw new Error('error.notEnoughSkr');
  };

  // Phantom ne fait que SIGNER la transaction déjà prête ; c'est l'app qui l'envoie ensuite.
  // Si Phantom l'envoyait lui-même, il dépendrait de son propre accès réseau : quand il échoue,
  // Phantom reste bloqué sans revenir à l'app. L'app, elle, a ses nouvelles tentatives et son relais.
  const signAndSend = async (transaction: Transaction): Promise<string> => {
    const signed = await transact(async (wallet: Web3MobileWallet) => {
      const address = await authorize(wallet);
      if (address !== publicKey) throw new Error('error.walletChanged');
      const [signedTransaction] = await wallet.signTransactions({ transactions: [transaction] });
      return signedTransaction;
    });
    // Renvoyer une transaction déjà signée est sans risque : Solana la reconnaît (même signature)
    const signature = await sendAndConfirm(signed.serialize(), transaction.lastValidBlockHeight);
    return signature;
  };

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await transact((wallet: Web3MobileWallet) => authorize(wallet));
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

  // Tip en USDC, avec en option un boost en SKR (qui va lui aussi au créateur) et une contribution
  // volontaire à TipStreak. Tout part dans la même transaction : une signature, tout ou rien.
  const sendTip = async (recipientAddress: string, amountUsdc: number, options: TipOptions = {}): Promise<string> => {
    if (!publicKey) throw new Error('error.walletNotConnected');
    const { message, boostSkr = 0, contributionUsdc = 0 } = options;
    const recipient = new PublicKey(recipientAddress);
    const transfers: SplTransfer[] = [{ mint: DEVNET_USDC_MINT, decimals: USDC_DECIMALS, recipient, amount: amountUsdc }];
    if (boostSkr > 0) {
      await checkSkrBalance(new PublicKey(publicKey), boostSkr);
      transfers.push({ mint: SKR_MINT, decimals: SKR_DECIMALS, recipient, amount: boostSkr });
    }
    if (contributionUsdc > 0) {
      transfers.push({ mint: DEVNET_USDC_MINT, decimals: USDC_DECIMALS, recipient: TREASURY, amount: contributionUsdc });
    }
    return signAndSend(await buildTransaction(transfers, message));
  };

  // Signature d'un simple message (gratuit, aucune transaction) : prouve qu'on possède le wallet.
  // Renvoie la charge signée telle que le wallet la fournit ; le serveur en extrait la signature.
  const signMessage = async (message: string): Promise<Uint8Array> => {
    if (!publicKey) throw new Error('error.walletNotConnected');
    const payload = Buffer.from(message, 'utf-8');
    const addressBase64 = Buffer.from(new PublicKey(publicKey).toBytes()).toString('base64');

    return transact(async (wallet: Web3MobileWallet) => {
      const address = await authorize(wallet);
      if (address !== publicKey) throw new Error('error.walletChanged');
      const [signedPayload] = await wallet.signMessages({ addresses: [addressBase64], payloads: [payload] });
      return signedPayload;
    });
  };

  const disconnect = () => {
    authTokenRef.current = null;
    setPublicKey(null);
    setSolBalance(null);
    setUsdcBalance(null);
  };

  return (
    <WalletContext.Provider
      value={{ publicKey, connecting, error, solBalance, usdcBalance, refreshingBalances, connect, disconnect, refreshBalances, sendTip, signMessage }}
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
