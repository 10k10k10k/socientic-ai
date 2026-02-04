const { parse } = require('url');

module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = parse(req.url, true);

  // Check if route matches /api/user/:wallet
  // Handling both /api/user/... and /user/... depending on how it's routed locally
  const userMatch = pathname.match(/\/?(?:api\/)?user\/([a-zA-Z0-9]+)/);

  if (userMatch) {
    const wallet = userMatch[1];
    
    // Mock Data Generator based on wallet string to make it consistent but "random"
    const randomSeed = wallet.length; 
    const winRate = 60 + (randomSeed % 30); // 60-90%
    const score = 70 + (randomSeed % 25);   // 70-95
    
    const mockData = {
      wallet: wallet,
      balance: `${(randomSeed * 0.5).toFixed(2)} ETH`,
      winRate: `${winRate}%`,
      predictiveScore: score,
      recentTrades: [
        { pair: 'ETH/USDT', type: 'Long', profit: '+12.5%' },
        { pair: 'SOL/USDT', type: 'Short', profit: '+5.2%' },
        { pair: 'BTC/USDT', type: 'Long', profit: '-2.1%' },
        { pair: 'LINK/USDT', type: 'Long', profit: '+8.4%' }
      ]
    };

    res.status(200).json(mockData);
    return;
  }

  // Default route
  res.status(200).send('Socientic AI Backend is Running. Endpoints: GET /api/user/:wallet');
};
