const supabase = require('../db');
const { scoreSignal } = require('./scorer');

// Constants
const INITIAL_BALANCE = 10000;
const TRADE_SIZE_USD = 1000; // Fixed trade size for simplicity
const TELEGRAM_ADMIN_ID = 'alpham3o'; // In reality this would be an ID, but telegraf can sometimes send to username if chat exists? No, needs ID usually. 
// But the prompt says "DM @alpham3o". I might need to resolve username to ID or just assume I have the ID. 
// I will just use a placeholder ID or try to send to the chat ID if known. 
// Actually, `bot.telegram.sendMessage(chatId, ...)` requires chat_id. 
// For this task, I'll accept a `notifyFn` callback.

async function fetchPrice(ticker) {
    // Mock price fetcher
    if (ticker === '$SOL') return 140.00;
    if (ticker === '$BTC') return 65000.00;
    if (ticker === '$ETH') return 3500.00;
    return (Math.random() * 100).toFixed(2);
}

const PaperTrader = {
    /**
     * Process a new scan signal.
     * @param {Object} scan - The scan object { ticker, ca, ... }
     * @param {Function} notifyFn - Callback to send Telegram message: (msg) => void
     */
    async processScan(scan, notifyFn) {
        const { ticker, ca } = scan;
        if (!ticker) return; // Only trade tickers for now

        // 1. Score the signal
        const score = scoreSignal(ticker, ca);
        console.log(`[PaperTrader] Scored ${ticker}: ${score}`);

        if (score > 80) {
            await this.executeBuy(ticker, score, notifyFn);
        }
    },

    async executeBuy(ticker, score, notifyFn) {
        const price = await fetchPrice(ticker);
        const amount = TRADE_SIZE_USD / price;

        console.log(`[PaperTrader] Executing BUY for ${ticker} @ $${price}`);

        // 2. Store trade in DB
        const tradeData = {
            ticker: ticker,
            buy_price: price,
            amount: amount,
            status: 'OPEN',
            pnl: 0
        };

        const { data, error } = await supabase
            .from('paper_trades')
            .insert([tradeData])
            .select();

        if (error) {
            console.error('[PaperTrader] Error storing trade:', error);
            return;
        }

        // 3. Notify
        // Calculate Total Equity
        const { data: closedTrades } = await supabase
            .from('paper_trades')
            .select('pnl')
            .eq('status', 'CLOSED');
        
        const realizedPnL = closedTrades ? closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) : 0;
        const totalEquity = (INITIAL_BALANCE + realizedPnL).toFixed(2);

        const msg = `🔔 PAPER TRADE: BUY ${ticker} @ $${price} | PnL: $0 | Total Equity: $${totalEquity}`;
        if (notifyFn) notifyFn(msg);
    },

    /**
     * Simple Sell Strategy Check
     * Call this periodically to check open trades.
     */
    async checkOpenTrades(notifyFn) {
        // Fetch open trades
        const { data: trades, error } = await supabase
            .from('paper_trades')
            .select('*')
            .eq('status', 'OPEN');

        if (error || !trades) return;

        for (const trade of trades) {
            const currentPrice = await fetchPrice(trade.ticker);
            const pnlPercent = ((currentPrice - trade.buy_price) / trade.buy_price) * 100;

            let action = null;
            if (pnlPercent >= 20) action = 'TAKE PROFIT';
            if (pnlPercent <= -10) action = 'STOP LOSS';

            if (action) {
                // Close Trade
                const pnlUsd = (currentPrice - trade.buy_price) * trade.amount;
                
                await supabase
                    .from('paper_trades')
                    .update({ 
                        status: 'CLOSED', 
                        pnl: pnlUsd 
                    })
                    .eq('id', trade.id);

                if (notifyFn) {
                    notifyFn(`🔔 PAPER TRADE: SELL ${trade.ticker} (${action}) @ $${currentPrice} | PnL: $${pnlUsd.toFixed(2)}`);
                }
            }
        }
    }
};

module.exports = PaperTrader;
