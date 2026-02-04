const supabase = require('../db');

/**
 * Calculates a win rate score (0-100) for a given user based on their scans.
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

        let profitableCount = 0;

        // Mock price performance for each scan
        scans.forEach(scan => {
            // Generate a random profit between -10% and +50%
            const mockProfitPercent = (Math.random() * 60) - 10;

            if (mockProfitPercent > 0) {
                profitableCount++;
            }
        });

        // Calculate win rate
        const winRate = (profitableCount / scans.length) * 100;

        // Return rounded score
        return Math.round(winRate);

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
