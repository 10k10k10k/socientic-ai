const supabase = require('../db');
const { createPublicClient, createWalletClient, http, parseUnits, erc20Abi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
require('dotenv').config();

// Configuration
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const COMPANY_WALLET = '0x1234567890123456789012345678901234567890'; // Placeholder
const SUBSCRIPTION_COST = 39; // USDC

// Initialize Viem Client
const publicClient = createPublicClient({
  chain: base,
  transport: http()
});

/**
 * Checks and processes subscription for a user.
 * @param {string} userId - The Telegram ID of the user.
 */
async function checkSubscription(userId) {
    console.log(`[Billing] Checking subscription for user ${userId}...`);

    // 1. Get user from DB
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userId)
        .single();

    if (error || !user) {
        console.error(`[Billing] User ${userId} not found.`);
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const subscriptionEnd = user.subscription_end || 0;

    // 2. Check if subscription is valid
    if (subscriptionEnd > now) {
        // Subscription is active
        if (user.status !== 'ACTIVE') {
             await supabase.from('users').update({ status: 'ACTIVE' }).eq('telegram_id', userId);
             console.log(`[Billing] User ${userId} status set to ACTIVE.`);
        }
        return;
    }

    console.log(`[Billing] Subscription expired for ${userId}. Checking funds...`);

    // 3. Check Funding (Base Only for now)
    if (!user.wallet_base_pub || !user.wallet_base_priv) {
        console.log(`[Billing] User ${userId} has no Base wallet. Pausing.`);
        await setPaused(userId, user.status);
        return;
    }

    try {
        // Check USDC Balance
        const balance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [user.wallet_base_pub]
        });

        const balanceUsd = Number(balance) / 1000000; // USDC 6 decimals
        console.log(`[Billing] User ${userId} Balance: $${balanceUsd}`);

        if (balanceUsd >= SUBSCRIPTION_COST) {
            console.log(`[Billing] Attempting to deduct $${SUBSCRIPTION_COST}...`);
            
            // 4. Deduct Funds
            const account = privateKeyToAccount(user.wallet_base_priv);
            const walletClient = createWalletClient({
                account,
                chain: base,
                transport: http()
            });

            // Simulate and Execute Transfer
            try {
                // Ensure the user has ETH for gas! 
                // We'll proceed; if it fails, it throws.
                const { request } = await publicClient.simulateContract({
                    account,
                    address: USDC_ADDRESS,
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [COMPANY_WALLET, parseUnits(SUBSCRIPTION_COST.toString(), 6)]
                });
                
                const hash = await walletClient.writeContract(request);
                console.log(`[Billing] Payment Successful! Tx: ${hash}`);

                // 5. Renew Subscription
                const newEnd = now + (30 * 24 * 60 * 60); // +30 days
                await supabase.from('users').update({
                    subscription_end: newEnd,
                    status: 'ACTIVE'
                }).eq('telegram_id', userId);
                
                console.log(`[Billing] Subscription renewed for ${userId}.`);

            } catch (txError) {
                console.error(`[Billing] Payment failed (Gas?):`, txError.message);
                await setPaused(userId, user.status);
            }

        } else {
            console.log(`[Billing] Insufficient funds. Pausing.`);
            await setPaused(userId, user.status);
        }
    } catch (err) {
        console.error('[Billing] Error checking balance:', err);
    }
}

async function setPaused(userId, currentStatus) {
    if (currentStatus !== 'PAUSED') {
        await supabase.from('users').update({ status: 'PAUSED' }).eq('telegram_id', userId);
        console.log(`[Billing] User ${userId} status set to PAUSED.`);
    }
}

module.exports = { checkSubscription };
