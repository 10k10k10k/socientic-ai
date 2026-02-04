const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const { privateKeyToAccount } = require('viem/accounts');
const { generatePrivateKey } = require('viem/accounts');

// Generate Solana Wallet
function generateSolanaWallet() {
  const keypair = Keypair.generate();
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: bs58.default.encode(keypair.secretKey)
  };
}

// Generate Base (EVM) Wallet
function generateBaseWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    privateKey: privateKey
  };
}

module.exports = {
  generateSolanaWallet,
  generateBaseWallet
};
