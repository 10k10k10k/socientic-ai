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

module.exports = {
    calculateWinRate
};
