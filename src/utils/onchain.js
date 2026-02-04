const axios = require('axios');

/**
 * Fetch token data from DexScreener API.
 * @param {string} ca - The contract address of the token.
 * @returns {Promise<Object|null>} - Object containing mcap, liquidity, and pair_age, or null if failed.
 */
async function getTokenData(ca) {
  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
    
    if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
      console.log(`No pairs found for CA: ${ca}`);
      return null;
    }

    // Find the pair with the highest liquidity
    const bestPair = response.data.pairs.sort((a, b) => {
      const liqA = a.liquidity ? a.liquidity.usd : 0;
      const liqB = b.liquidity ? b.liquidity.usd : 0;
      return liqB - liqA;
    })[0];

    if (!bestPair) return null;

    const mcap = bestPair.fdv || bestPair.marketCap || 0;
    const liquidity = bestPair.liquidity ? bestPair.liquidity.usd : 0;
    
    let pairAge = 'Unknown';
    if (bestPair.pairCreatedAt) {
      const createdTime = new Date(bestPair.pairCreatedAt);
      const now = new Date();
      const diffMs = now - createdTime;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        pairAge = `${diffDays} days`;
      } else {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        pairAge = `${diffHours} hours`;
      }
    }

    return {
      mcap: parseFloat(mcap),
      liquidity: parseFloat(liquidity),
      pair_age: pairAge
    };

  } catch (error) {
    console.error(`Error fetching token data for ${ca}:`, error.message);
    return null;
  }
}

module.exports = { getTokenData };
