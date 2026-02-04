/**
 * Liquidation Logic for Off-Chain Withdrawal Handler
 * 
 * Implements logic to liquidate user portfolio holdings into USDC
 * and trigger a withdrawal on the smart contract.
 */

// Mock Database/Portfolio Access
async function getPortfolioHoldings(userId) {
    // Mock data - in production this would fetch from the database
    return [
        { token: "SOL", amount: 10.5, address: "So11111111111111111111111111111111111111112" },
        { token: "BONK", amount: 5000000, address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
        { token: "USDC", amount: 100, address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }
    ];
}

// Mock Smart Contract Interface
const mockContract = {
    /**
     * Swap tokens for USDC via the contract agent
     * @param {string} tokenAddress 
     * @param {number} amountToSell 
     * @param {number} minOut 
     */
    agentSwap: async (tokenAddress, amountToSell, minOut) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[MockContract] Swapping ${amountToSell} of ${tokenAddress} for USDC (minOut: ${minOut})...`);
        return { txHash: "0x_swap_" + Math.random().toString(36).substring(7) };
    },

    /**
     * Withdraw USDC to the user
     * @param {string} userId 
     * @param {number} usdcAmount 
     */
    withdraw: async (userId, usdcAmount) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[MockContract] Withdrawing ${usdcAmount} USDC to User ${userId}...`);
        return { txHash: "0x_withdraw_" + Math.random().toString(36).substring(7) };
    }
};

/**
 * Handle user withdrawal by liquidating a percentage of their portfolio.
 * 
 * 1. Fetch user holdings.
 * 2. Calculate amount to sell for each holding based on percent.
 * 3. Execute swaps for non-USDC assets.
 * 4. Trigger withdrawal of realized USDC.
 * 
 * @param {string} userId 
 * @param {number} percent - Percentage to withdraw (0-100)
 */
async function handleWithdrawal(userId, percent) {
    console.log(`Starting withdrawal for user ${userId} (${percent}%)`);
    
    if (percent <= 0 || percent > 100) {
        console.error("Invalid percentage");
        return { success: false, error: "Invalid percentage" };
    }

    // 1. Check Portfolio Holdings
    const holdings = await getPortfolioHoldings(userId);
    if (!holdings || holdings.length === 0) {
        console.log("No holdings found for user.");
        return { success: false, error: "No holdings" };
    }

    let totalUsdcValueToWithdraw = 0;
    
    // 2. Generate swap params and sell
    for (const holding of holdings) {
        const amountToSell = holding.amount * (percent / 100);
        
        if (amountToSell === 0) continue;

        // If it's already USDC, we don't need to swap, just account for it
        if (holding.token === 'USDC' || holding.address === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
            console.log(`Processing USDC directly: ${amountToSell}`);
            totalUsdcValueToWithdraw += amountToSell;
            continue;
        }

        // Generate swap params
        // Mocking price retrieval - in real app, fetch current price for slippage calc
        const mockPrice = 10; // Placeholder price
        const estimatedValue = amountToSell * mockPrice;
        const slippage = 0.01; // 1%
        const minOut = estimatedValue * (1 - slippage);

        try {
            // 3. Send agentSwap transaction
            const tx = await mockContract.agentSwap(holding.address, amountToSell, minOut);
            console.log(`Swap successful for ${holding.token}: ${tx.txHash}`);
            
            // Assume the swap resulted in 'minOut' USDC roughly (mock logic)
            totalUsdcValueToWithdraw += minOut; 
        } catch (error) {
            console.error(`Failed to swap ${holding.token}:`, error);
            // Continue with other tokens or abort? Usually best to continue or retry.
        }
    }

    console.log(`Total USDC available for withdrawal: ${totalUsdcValueToWithdraw}`);

    if (totalUsdcValueToWithdraw > 0) {
        // 4. Call withdraw on the contract
        try {
            const withdrawTx = await mockContract.withdraw(userId, totalUsdcValueToWithdraw);
            console.log(`Withdrawal Transaction Sent: ${withdrawTx.txHash}`);
            return { 
                success: true, 
                txHash: withdrawTx.txHash,
                amount: totalUsdcValueToWithdraw 
            };
        } catch (error) {
            console.error("Withdrawal transaction failed:", error);
            return { success: false, error: error.message };
        }
    } else {
        console.log("No USDC value generated to withdraw.");
        return { success: false, error: "No funds to withdraw" };
    }
}

module.exports = { handleWithdrawal };
