const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const { createPublicClient, http, formatUnits, erc20Abi } = require('viem');
const { base } = require('viem/chains');
const { ClawCredit } = require('@t54-labs/clawcredit-sdk');

// Mock Database (In-memory for now)
const userWallets = new Map();

// Base USDC Contract
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Initialize Viem Client for Base
const client = createPublicClient({
  chain: base,
  transport: http()
});

// Initialize ClawCredit SDK
const credit = new ClawCredit();
let isCreditInitialized = false;

/**
 * Initializes the Credit SDK.
 * Requires CLAW_INVITE_CODE in environment variables.
 */
async function initCredit() {
  if (isCreditInitialized) return;
  
  const inviteCode = process.env.CLAW_INVITE_CODE;
  if (!inviteCode) {
    console.warn('[Credit] CLAW_INVITE_CODE not found in environment. Credit features cannot be initialized.');
    return;
  }

  try {
    console.log('[Credit] Registering agent...');
    // Register the agent to get a credit limit.
    // The SDK auto-collects audit materials (core_code, system_prompt, etc.)
    await credit.register({
      inviteCode: inviteCode,
      runtimeEnv: 'node',
      model: process.env.MODEL_NAME || 'unknown'
    });
    
    isCreditInitialized = true;
    console.log('[Credit] Registration successful.');
  } catch (error) {
    console.error('[Credit] Registration failed:', error.message);
    // We don't throw here to allow other wallet features to work
  }
}

/**
 * Creates a new wallet for a user.
 * Generates a private key, creates an account, and stores it in memory.
 * In production, the private key must be encrypted and stored in a secure DB.
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<string>} The new Base address
 */
async function createWallet(userId) {
  try {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    // Store in mock DB
    userWallets.set(userId, {
      address: account.address,
      privateKey: privateKey
    });

    console.log(`[Wallet] Created wallet for ${userId}: ${account.address}`);
    return account.address;
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
}

/**
 * Checks the USDC balance for a user on Base.
 * 
 * @param {string} userId - The user's ID
 * @returns {Promise<string>} Balance in USDC (formatted)
 */
async function checkBalance(userId) {
  try {
    const userData = userWallets.get(userId);
    if (!userData) {
      throw new Error(`User wallet not found for userId: ${userId}`);
    }

    // Read USDC balance
    const balance = await client.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userData.address]
    });

    // USDC has 6 decimals
    const formatted = formatUnits(balance, 6);
    console.log(`[Wallet] Balance for ${userId} (${userData.address}): ${formatted} USDC`);
    return formatted;
  } catch (error) {
    console.error('Error checking balance:', error);
    throw error;
  }
}

/**
 * Checks the credit line status using ClawCredit SDK.
 * 
 * @returns {Promise<Object>} Credit status object
 */
async function checkCreditStatus() {
  await initCredit();

  if (!isCreditInitialized) {
      return { 
          status: 'unavailable', 
          message: 'Credit integration not initialized (missing invite code or registration failed).' 
      };
  }

  try {
    console.log('[Credit] Checking credit status...');
    // Fetch balance/limit and repayment status
    const balance = await credit.getBalance(); // Assumed method based on prototype
    const status = await credit.getRepaymentStatus(); // Assumed method based on prototype
    
    return {
      balance,
      repaymentStatus: status
    };
  } catch (error) {
    console.error('Error checking credit status:', error);
    // Return a fallback or rethrow depending on requirements
    return { error: error.message };
  }
}

// Export functions
module.exports = {
  createWallet,
  checkBalance,
  checkCreditStatus,
  // Helper for debug/testing
  _getUserAddress: (userId) => userWallets.get(userId)?.address
};
