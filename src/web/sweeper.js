const supabase = require('../db');

const ADMIN_SOL_WALLET = 'Fuotq...'; // Placeholder as per instructions

// Mocked list of user deposit wallets with pending USDC balances
const MOCKED_DEPOSIT_WALLETS = [
    { userId: '123456789', walletAddress: 'DepoWallet1...', balanceUSDC: 100.00 },
    { userId: '987654321', walletAddress: 'DepoWallet2...', balanceUSDC: 500.50 },
    { userId: '555555555', walletAddress: 'DepoWallet3...', balanceUSDC: 10.00 },
];

async function sweepFunds() {
    console.log('--- Starting Black Box Sweep ---');
    console.log(`Target Admin Wallet: ${ADMIN_SOL_WALLET}`);

    let totalSwept = 0;
    let totalFees = 0;

    for (const wallet of MOCKED_DEPOSIT_WALLETS) {
        // Ensure mock users exist in the users table
        const { error: userError } = await supabase.from('users').upsert({
            telegram_id: wallet.userId,
            username: `user_${wallet.userId}`
        }, { onConflict: 'telegram_id' });

        if (userError) {
            console.error(`[ERROR] Failed to upsert user ${wallet.userId}:`, userError.message);
            continue;
        }
        
        if (wallet.balanceUSDC <= 0) continue;

        const amount = wallet.balanceUSDC;
        const fee = amount * 0.01;
        const netAmount = amount - fee;

        // 1. Simulate sending funds to Admin Wallet
        console.log(`[SWEEP] Sweeping ${amount} USDC from ${wallet.walletAddress} (User: ${wallet.userId}) to ${ADMIN_SOL_WALLET}`);
        
        // 2. Log Fee
        console.log(`[FEE] 1% Fee Taken: ${fee.toFixed(2)} USDC from User ${wallet.userId}`);

        // 3. Update Internal Ledger (Credit Virtual Balance)
        // We need to fetch current balance first or use an RPC if we want atomic increment, 
        // but for now we'll do read-modify-write as Supabase simple update doesn't support increment easily without RPC
        
        // Let's try to find if we can use a custom RPC or just upsert.
        // Since we don't have an increment RPC, we'll read first.
        
        try {
            const { data: ledgerEntry, error: fetchError } = await supabase
                .from('ledger')
                .select('virtual_balance')
                .eq('user_id', wallet.userId)
                .single();
            
            let currentBalance = 0;
            if (ledgerEntry) {
                currentBalance = ledgerEntry.virtual_balance;
            }

            const newBalance = currentBalance + netAmount;
            const timestamp = Math.floor(Date.now() / 1000);

            const { error: upsertError } = await supabase.from('ledger').upsert({
                user_id: wallet.userId,
                virtual_balance: newBalance,
                last_updated: timestamp
            });

            if (upsertError) throw upsertError;
            
            console.log(`[LEDGER] Credited ${netAmount.toFixed(2)} USDC to User ${wallet.userId} Virtual Balance (New: ${newBalance})`);
            
            totalSwept += amount;
            totalFees += fee;

        } catch (error) {
            console.error(`[ERROR] Failed to update ledger for user ${wallet.userId}:`, error.message);
        }
    }

    console.log('--- Sweep Complete ---');
    console.log(`Total Swept: ${totalSwept.toFixed(2)} USDC`);
    console.log(`Total Fees: ${totalFees.toFixed(2)} USDC`);
}

// Allow running directly if main module
if (require.main === module) {
    sweepFunds();
}

module.exports = { sweepFunds };
