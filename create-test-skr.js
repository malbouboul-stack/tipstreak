// Script à exécuter avec : node create-test-skr.js TON_ADRESSE_WALLET
//
// Crée un jeton de test "TSKR" sur devnet (SKR n'existe pas encore sur devnet,
// seulement sur mainnet : SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3).
// Envoie 1000 TSKR de test vers ton wallet, et écrit l'adresse dans
// src/constants/skr.ts pour que l'app puisse l'utiliser directement.
//
// Ne dépend PAS du faucet public (souvent saturé) : si le portefeuille
// technique n'a pas assez de SOL, le script te demande d'en envoyer un peu
// depuis ton propre Phantom.

const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const AUTHORITY_FILE = path.join(__dirname, '.skr-mint-authority.json');

function loadOrCreateAuthority() {
  if (fs.existsSync(AUTHORITY_FILE)) {
    const secret = JSON.parse(fs.readFileSync(AUTHORITY_FILE, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(AUTHORITY_FILE, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function main() {
  const recipientAddress = process.argv[2];
  if (!recipientAddress) {
    console.error('Usage : node create-test-skr.js TON_ADRESSE_WALLET_DEVNET');
    process.exit(1);
  }

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const mintAuthority = loadOrCreateAuthority();

  console.log('Portefeuille technique (réutilisé si tu relances le script) :');
  console.log('  ' + mintAuthority.publicKey.toBase58());

  let balance = await connection.getBalance(mintAuthority.publicKey);

  if (balance < 0.02 * LAMPORTS_PER_SOL) {
    console.log('\n⚠️  Ce portefeuille n\'a pas assez de SOL (le faucet public est saturé actuellement).');
    console.log('Envoie manuellement 0.05 SOL depuis TON wallet Phantom vers cette adresse :');
    console.log('\n   ' + mintAuthority.publicKey.toBase58() + '\n');
    console.log('(Dans Phantom : Envoyer → colle cette adresse → 0.05 SOL → Confirmer → attends la confirmation)');
    await ask('\nAppuie sur Entrée une fois le SOL bien envoyé et confirmé...');

    balance = await connection.getBalance(mintAuthority.publicKey);
    if (balance < 0.02 * LAMPORTS_PER_SOL) {
      console.error('\nToujours pas assez de SOL reçu sur ce portefeuille. Vérifie la transaction puis relance le script (il réutilisera la même adresse).');
      process.exit(1);
    }
  }

  console.log('Solde disponible :', (balance / LAMPORTS_PER_SOL).toFixed(4), 'SOL\n');

  console.log('1/2 — Création du jeton de test TSKR...');
  const mint = await createMint(connection, mintAuthority, mintAuthority.publicKey, null, 6);
  console.log('    Mint créé :', mint.toBase58());

  console.log('2/2 — Envoi de 1000 TSKR vers ton wallet...');
  const recipientPubkey = new PublicKey(recipientAddress);
  const recipientAta = await getOrCreateAssociatedTokenAccount(connection, mintAuthority, mint, recipientPubkey);
  await mintTo(connection, mintAuthority, mint, recipientAta.address, mintAuthority, 1000 * 10 ** 6);

  const constantsDir = path.join(__dirname, 'src', 'constants');
  fs.mkdirSync(constantsDir, { recursive: true });

  const fileContent = `// Fichier généré automatiquement par create-test-skr.js le ${new Date().toISOString()}
//
// TSKR = jeton de test devnet représentant SKR pour les besoins de la démo.
// Le vrai SKR n'existe que sur mainnet et n'a pas d'équivalent devnet officiel.
// Pour passer en production, remplace uniquement SKR_MINT_ADDRESS par :
// SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3

export const SKR_MINT_ADDRESS = '${mint.toBase58()}';
export const SKR_DECIMALS = 6;
`;

  fs.writeFileSync(path.join(constantsDir, 'skr.ts'), fileContent);

  console.log('\n✅ Terminé !');
  console.log('   Mint TSKR :', mint.toBase58());
  console.log('   1000 TSKR envoyés à :', recipientAddress);
  console.log('   Fichier src/constants/skr.ts créé automatiquement.');
}

main().catch((e) => {
  console.error('Erreur :', e.message || e);
  process.exit(1);
});
