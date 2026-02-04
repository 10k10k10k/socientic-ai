const db = require('../db');

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

    // Ensure mock users exist in the users table to satisfy Foreign Key constraints
    const insertUserStmt = db.prepare(`
        INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)
    `);

    for (const wallet of MOCKED_DEPOSIT_WALLETS) {
        insertUserStmt.run(wallet.userId, `user_${wallet.userId}`);
        
        if (wallet.balanceUSDC <= 0) continue;

        const amount = wallet.balanceUSDC;
        const fee = amount * 0.01;
        const netAmount = amount - fee;

        // 1. Simulate sending funds to Admin Wallet
        console.log(`[SWEEP] Sweeping ${amount} USDC from ${wallet.walletAddress} (User: ${wallet.userId}) to ${ADMIN_SOL_WALLET}`);
        
        // 2. Log Fee
        console.log(`[FEE] 1% Fee Taken: ${fee.toFixed(2)} USDC from User ${wallet.userId}`);

        // 3. Update Internal Ledger (Credit Virtual Balance)
        try {
            const stmt = db.prepare(`
                INSERT INTO ledger (user_id, virtual_balance, last_updated)
                VALUES (?, ?, strftime('%s', 'now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    virtual_balance = virtual_balance + ?,
                    last_updated = strftime('%s', 'now')
            `);
            
            stmt.run(wallet.userId, netAmount, netAmount);
            console.log(`[LEDGER] Credited ${netAmount.toFixed(2)} USDC to User ${wallet.userId} Virtual Balance`);
            
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
