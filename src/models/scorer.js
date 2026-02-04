const db = require('../db/index.js');

/**
 * Calculates a win rate score (0-100) for a given user based on their scans.
 * 
 * NOTE: This is an MVP implementation using mocked price performance.
 * 
 * @param {string} userId - The Telegram ID of the user.
 * @returns {number} - The calculated score (0-100).
 */
function calculateWinRate(userId) {
    try {
        // Query scans for the user
        const stmt = db.prepare('SELECT * FROM scans WHERE user_id = ?');
        const scans = stmt.all(userId);

        // Handle cases with 0 or 1 scan gracefully (neutral score)
        if (!scans || scans.length <= 1) {
            return 50;
        }

        let profitableCount = 0;

        // Mock price performance for each scan
        scans.forEach(scan => {
            // Generate a random profit between -10% and +50%
            // Math.random() is [0, 1)
            // Range needed: 60 (from -10 to 50)
            // Offset: -10
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
