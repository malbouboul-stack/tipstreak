import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { Buffer } from 'buffer';
import { fetchWithRetry } from '../lib/network';
import { getItem, setItem } from '../lib/storage';
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

// Envoie une transaction signée et attend sa confirmation. Sans attendre, le solde affiché et l'Edge Function
// record-tip pourraient encore voir l'état d'avant l'envoi.
// - Pas de simulation préalable (skipPreflight) : sur devnet, le nœud qui simule est parfois en retard et
//   répond "Blockhash not found" pour une transaction pourtant valide. Les erreurs réelles restent détectées
//   par la confirmation (status.err).
// - La transaction est renvoyée régulièrement tant qu'elle n'est pas confirmée (un nœud peut la perdre) :
//   c'est sans risque, Solana la reconnaît à sa signature et ne l'exécute qu'une fois.
// - Si son blockhash expire avant qu'elle soit incluse, rien n'a été débité : on le dit clairement.
async function sendAndConfirm(
  raw: Buffer,
  lastValidBlockHeight: number | undefined,
  onSent: () => void,
  timeoutMs = 90000
): Promise<string> {
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const send = () => connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });

  // Premier envoi : si le RPC est saturé même via le relais, on réessaie quelques fois avant d'abandonner.
  // La signature d'une transaction est connue d'avance : on peut la suivre même si un envoi a "échoué".
  let signature: string | null = null;
  for (let attempt = 0; attempt < 4 && !signature; attempt++) {
    try {
      signature = await send();
    } catch (e) {
      if (attempt === 3) throw e;
      await pause(1500 * (attempt + 1));
    }
  }
  onSent();
  const deadline = Date.now() + timeoutMs;
  let lastSend = Date.now();
  let lastHeightCheck = 0;
  while (Date.now() < deadline) {
    // Requêtes espacées (le RPC public limite les appels) ; une requête refusée n'interrompt pas le suivi
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
        // Dernière vérification : expirée ET jamais exécutée, sinon on ne doit surtout pas la refaire
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
// Étapes d'un envoi : préparation (ou nouvelle préparation si la 1re a expiré), signature dans le wallet,
// envoi au réseau, attente de confirmation
export type TxStep = 'preparing' | 'signing' | 'sending' | 'confirming';
export type TipOptions = {
  message?: string;
  boostSkr?: number;
  contributionUsdc?: number;
  onProgress?: (step: TxStep) => void;
};

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

// Connexion mémorisée sur le téléphone : seulement l'adresse publique du wallet (aucune clé, aucun jeton).
// Android peut fermer l'app en arrière-plan : au retour, on reste connecté.
const SESSION_KEY = 'tipstreak.wallet';
type StoredSession = { publicKey: string };

function loadSession(): StoredSession | null {
  try {
    const session = JSON.parse(getItem(SESSION_KEY) ?? 'null');
    return typeof session?.publicKey === 'string' ? session : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null) {
  setItem(SESSION_KEY, session ? JSON.stringify(session) : null);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [restored] = useState(loadSession);
  const [publicKey, setPublicKey] = useState<string | null>(restored?.publicKey ?? null);
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

  // Connexion retrouvée au démarrage : on recharge les soldes une fois
  useEffect(() => {
    if (!restored) return;
    const frame = requestAnimationFrame(() => refreshBalances(restored.publicKey));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jeton d'autorisation de la session en cours uniquement : un jeton gardé d'un lancement à l'autre
  // n'apportait rien (Phantom redemande "Connecter" aux apps non vérifiées) et pouvait faire échouer la session.
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
    // Rien d'autre ici : on est DANS la session wallet (app en pause). La connexion est mémorisée
    // une fois revenu dans l'app (connect, withWallet).
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
      // Blockhash "finalized" (un peu plus ancien) plutôt que le tout dernier : le RPC du wallet, parfois en retard
      // sur le nôtre, le connaît déjà et peut simuler la transaction tout de suite. Avec le tout dernier,
      // Phantom gardait son bouton Confirmer grisé jusqu'à le voir, et la transaction finissait par expirer.
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

  // Ouvre une session wallet sur le compte connecté. Si le wallet renvoie un AUTRE compte (compte changé
  // dans Phantom), on ne signe rien de ce qui a été préparé pour l'ancien : l'app bascule sur le nouveau
  // compte, recharge ses soldes, et l'utilisateur relance l'action (qui sera alors préparée pour lui).
  const withWallet = async <T,>(action: (wallet: Web3MobileWallet) => Promise<T>): Promise<T> => {
    let switchedTo: string | null = null;
    try {
      return await transact(async (wallet: Web3MobileWallet) => {
        const address = await authorize(wallet);
        if (address !== publicKey) {
          switchedTo = address;
          throw new Error('error.walletChanged');
        }
        return action(wallet);
      });
    } catch (e) {
      if (switchedTo) {
        setPublicKey(switchedTo);
        saveSession({ publicKey: switchedTo });
        setSolBalance(null);
        setUsdcBalance(null);
        refreshBalances(switchedTo);
      }
      throw e;
    }
  };

  // Phantom ne fait que SIGNER la transaction déjà prête ; c'est l'app qui l'envoie ensuite.
  // Si Phantom l'envoyait lui-même, il dépendrait de son propre accès réseau : quand il échoue,
  // Phantom reste bloqué sans revenir à l'app. L'app, elle, a ses nouvelles tentatives et son relais.
  // `onProgress` : chaque étape réelle est signalée, pour que l'écran avance au rythme de la transaction.
  const signAndSend = async (transaction: Transaction, onProgress?: (step: TxStep) => void): Promise<string> => {
    onProgress?.('signing');
    // ⚠️ Pendant la session wallet, AUCUN appel réseau ni minuteur : le wallet est au premier plan et Android
    // met l'app en pause (ses setTimeout ne se déclenchent plus). Une requête faite ici peut bloquer la session
    // et la demande de signature n'arrive jamais au wallet. Tout est préparé avant (buildTransaction).
    const signed = await withWallet(async (wallet) => {
      const [signedTransaction] = await wallet.signTransactions({ transactions: [transaction] });
      return signedTransaction;
    });
    onProgress?.('sending');
    return sendAndConfirm(signed.serialize(), transaction.lastValidBlockHeight, () => onProgress?.('confirming'));
  };

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await transact((wallet: Web3MobileWallet) => authorize(wallet));
      setPublicKey(address);
      saveSession({ publicKey: address });
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
    const { message, boostSkr = 0, contributionUsdc = 0, onProgress } = options;
    const recipient = new PublicKey(recipientAddress);
    const transfers: SplTransfer[] = [{ mint: DEVNET_USDC_MINT, decimals: USDC_DECIMALS, recipient, amount: amountUsdc }];
    if (boostSkr > 0) {
      await checkSkrBalance(new PublicKey(publicKey), boostSkr);
      transfers.push({ mint: SKR_MINT, decimals: SKR_DECIMALS, recipient, amount: boostSkr });
    }
    if (contributionUsdc > 0) {
      transfers.push({ mint: DEVNET_USDC_MINT, decimals: USDC_DECIMALS, recipient: TREASURY, amount: contributionUsdc });
    }
    try {
      return await signAndSend(await buildTransaction(transfers, message), onProgress);
    } catch (e: any) {
      // Expirée sans avoir été exécutée (vérifié dans sendAndConfirm) : on la refait une fois avec un
      // blockhash neuf, le wallet redemande simplement une validation. Aucun risque de payer deux fois.
      if (e?.message !== 'error.txExpired') throw e;
      onProgress?.('preparing');
      return signAndSend(await buildTransaction(transfers, message), onProgress);
    }
  };

  // Signature d'un simple message (gratuit, aucune transaction) : prouve qu'on possède le wallet.
  // Renvoie la charge signée telle que le wallet la fournit ; le serveur en extrait la signature.
  const signMessage = async (message: string): Promise<Uint8Array> => {
    if (!publicKey) throw new Error('error.walletNotConnected');
    const payload = Buffer.from(message, 'utf-8');
    const addressBase64 = Buffer.from(new PublicKey(publicKey).toBytes()).toString('base64');

    return withWallet(async (wallet) => {
      const [signedPayload] = await wallet.signMessages({ addresses: [addressBase64], payloads: [payload] });
      return signedPayload;
    });
  };

  const disconnect = () => {
    authTokenRef.current = null;
    saveSession(null);
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
