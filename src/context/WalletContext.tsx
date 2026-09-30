import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Buffer } from 'buffer';
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
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// Attend que la transaction soit confirmée. Sans ça, le solde affiché et l'Edge Function
// record-tip peuvent encore voir l'état d'avant l'envoi.
async function waitForConfirmation(signature: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error('La transaction a échoué on-chain');
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Transaction envoyée mais pas encore confirmée par le réseau");
}

type WalletContextType = {
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
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

  const refreshBalances = async (address?: string) => {
    const target = address ?? publicKey;
    if (!target) return;
    setRefreshingBalances(true);
    try {
      const owner = new PublicKey(target);

      const lamports = await connection.getBalance(owner);
      setSolBalance(lamports / LAMPORTS_PER_SOL);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
        mint: DEVNET_USDC_MINT,
      });
      if (tokenAccounts.value.length > 0) {
        const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setUsdcBalance(amount ?? 0);
      } else {
        setUsdcBalance(0);
      }
    } catch (e) {
      console.error('Balance fetch error', e);
      // On laisse les anciennes valeurs plutôt que de les effacer sur une erreur réseau ponctuelle
    } finally {
      setRefreshingBalances(false);
    }
  };

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await transact(async (wallet: Web3MobileWallet) => {
        const authResult = await wallet.authorize({
          cluster: 'devnet',
          identity: {
            name: 'TipStreak',
            uri: 'https://tipstreak.app',
            icon: 'favicon.ico',
          },
        });
        const rawAddress = authResult.accounts[0].address;
        const address = new PublicKey(Buffer.from(rawAddress, 'base64')).toBase58();
        setPublicKey(address);
        await refreshBalances(address);
      });
    } catch (e: any) {
      console.error('Wallet connect error', e);
      setError(
        e?.message?.includes('No wallet')
          ? "Aucun wallet compatible trouvé sur ce téléphone (installe Phantom ou Solflare)."
          : "Connexion au wallet annulée ou échouée."
      );
    } finally {
      setConnecting(false);
    }
  };

  const sendTip = async (recipientAddress: string, amountUsdc: number, message?: string): Promise<string> => {
    if (!publicKey) throw new Error('Wallet non connecté');

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
    if (!publicKey) throw new Error('Wallet non connecté');

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
    if (!publicKey) throw new Error('Wallet non connecté');

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
        throw new Error("Le wallet a changé depuis la connexion : reconnecte-le dans l'onglet Profil");
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
