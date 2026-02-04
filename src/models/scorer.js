const supabase = require('../db');

/**
 * Calculates the Sharpe Ratio for a given history of returns.
 * Sharpe = (Avg Return - RiskFreeRate) / StdDev
 * 
 * @param {number[]} returns - Array of percentage returns.
 * @returns {number} - The calculated Sharpe Ratio.
 */
function calculateSharpeRatio(returns) {
    if (!returns || returns.length === 0) return 0;

    const riskFreeRate = 0; // Assuming 0% risk-free rate for simplicity
    const averageReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    
    // Calculate Standard Deviation
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - averageReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0; // Avoid division by zero

    return (averageReturn - riskFreeRate) / stdDev;
}

/**
 * Calculates a predictive score (0-100) for a given user based on their scans.
 * Uses Win Rate, Sharpe Ratio, and Volume.
 * 
 * NOTE: This is an MVP implementation using mocked price performance.
 * 
 * @param {string} userId - The Telegram ID of the user.
 * @returns {Promise<number>} - The calculated score (0-100).
 */
async function calculateWinRate(userId) {
    try {
        // Query scans for the user
        const { data: scans, error } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching scans:', error);
            return 50;
        }

        // Handle cases with 0 or 1 scan gracefully (neutral score)
        if (!scans || scans.length <= 1) {
            return 50;
        }

        const tradeHistory = [];
        const volumeScores = [];

        // Mock price performance and volume for each scan
        scans.forEach(scan => {
            // Generate a random profit between -10% and +50%
            const mockProfitPercent = (Math.random() * 60) - 10;
            tradeHistory.push(mockProfitPercent);

            // Generate a random volume score (0-100)
            const mockVolumeScore = Math.floor(Math.random() * 100);
            volumeScores.push(mockVolumeScore);
        });

        // Calculate Win Rate
        const profitableCount = tradeHistory.filter(p => p > 0).length;
        const winRate = (profitableCount / tradeHistory.length) * 100;

        // Calculate Sharpe Ratio
        const sharpe = calculateSharpeRatio(tradeHistory);

        // Calculate Average Volume Score
        const avgVolume = volumeScores.reduce((a, b) => a + b, 0) / volumeScores.length;

        // Calculate Predictive Score
        // Formula: (WinRate * 0.4) + (Sharpe * 0.4) + (Volume * 0.2)
        const predictiveScore = (winRate * 0.4) + (sharpe * 0.4) + (avgVolume * 0.2);

        // Return rounded score
        return Math.round(predictiveScore);

    } catch (error) {
        console.error('Error calculating win rate:', error);
        return 50; // Fallback to neutral score on error
    }
}

/**
 * Scores a specific signal/ticker to decide whether to trade.
 * 
 * @param {string} ticker - The ticker symbol (e.g. $SOL).
 * @param {string} ca - The contract address (optional).
 * @returns {number} - The score (0-100).
 */
function scoreSignal(ticker, ca) {
    // Mock logic: 
    // - If ticker is $SOL or $BTC, High Confidence (85-95)
    // - Otherwise, random score (40-90)
    
    if (ticker === '$SOL' || ticker === '$BTC' || ticker === '$ETH') {
        return 85 + Math.floor(Math.random() * 10);
    }
    
    return 40 + Math.floor(Math.random() * 50);
}

module.exports = {
    calculateWinRate,
    scoreSignal
};
