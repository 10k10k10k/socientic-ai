const { Telegraf } = require('telegraf');
require('dotenv').config();
const db = require('../db');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Basic logging for development
bot.use(async (ctx, next) => {
  const messageText = ctx.message?.text || '[non-text message]';
  const username = ctx.from?.username || 'unknown';
  console.log(`[${new Date().toISOString()}] Message from ${ctx.from?.id} (${username}): ${messageText}`);
  return next();
});

bot.start((ctx) => {
  ctx.reply('Welcome to Socientic AI! 🥧\n\nI am your primary hub for managing trading bots and tracking predictive power.\n\nTo get started, add me to your group or fund your Gas Tank at our website (coming soon).');
});

bot.help((ctx) => {
  ctx.reply('Commands:\n/start - Initialize the bot\n/status - Check your gas tank and active bots\n/track - Start tracking predictive power in this group (Admin only)');
});

// Prepared statements for DB operations
const upsertUser = db.prepare(`
  INSERT INTO users (telegram_id, username, first_name)
  VALUES (@telegram_id, @username, @first_name)
  ON CONFLICT(telegram_id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name
`);

const upsertGroup = db.prepare(`
  INSERT INTO groups (telegram_id, title, type)
  VALUES (@telegram_id, @title, @type)
  ON CONFLICT(telegram_id) DO UPDATE SET
    title = excluded.title,
    type = excluded.type
`);

const insertScan = db.prepare(`
  INSERT INTO scans (user_id, group_id, ticker, ca, timestamp)
  VALUES (@user_id, @group_id, @ticker, @ca, @timestamp)
`);

// Listener for coin mentions
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (!text) return;

  // Look for CA-like strings (0x... or Solana-like base58 strings - usually 32-44 chars)
  // Strict EVM regex: 0x[a-fA-F0-9]{40}
  // Simple "looks like a sol address" regex: [1-9A-HJ-NP-Za-km-z]{32,44} (Generic base58 check is safer)
  // For now, sticking to EVM 0x and generic alphanumeric for Solana CAs if identified explicitly, 
  // but let's stick to the prompt's implied simple "CA". 
  // I will use a robust EVM regex and a broader one for potential CAs if needed.
  // The original file had: /0x[a-fA-F0-9]{40}/g
  
  const caRegex = /0x[a-fA-F0-9]{40}/g;
  const cas = text.match(caRegex) || [];
  
  // Look for $TICKER
  const tickerRegex = /\$[A-Z]{2,10}/g;
  const tickers = text.match(tickerRegex) || [];

  if (cas.length > 0 || tickers.length > 0) {
    console.log(`Found potential signals: CAs: ${cas}, Tickers: ${tickers}`);

    try {
      // 1. Upsert User
      if (ctx.from) {
        upsertUser.run({
          telegram_id: ctx.from.id.toString(),
          username: ctx.from.username || null,
          first_name: ctx.from.first_name || null
        });
      }

      // 2. Upsert Group (if applicable)
      let groupId = null;
      if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
        groupId = ctx.chat.id.toString();
        upsertGroup.run({
          telegram_id: groupId,
          title: ctx.chat.title || null,
          type: ctx.chat.type
        });
      }

      // 3. Insert Scans
      const timestamp = Math.floor(Date.now() / 1000);
      const userId = ctx.from ? ctx.from.id.toString() : null;

      // We treat every combination of CA and Ticker found as a potential scan or 
      // if multiple are found, record them individually. 
      // Strategy: Log each CA found. Log each Ticker found.
      
      const insertTransaction = db.transaction((foundCas, foundTickers) => {
        for (const ca of foundCas) {
          insertScan.run({
            user_id: userId,
            group_id: groupId,
            ticker: null,
            ca: ca,
            timestamp: timestamp
          });
        }
        for (const ticker of foundTickers) {
          insertScan.run({
            user_id: userId,
            group_id: groupId,
            ticker: ticker,
            ca: null, // explicit null if just ticker
            timestamp: timestamp
          });
        }
      });

      insertTransaction(cas, tickers);
      console.log('Saved scans to database.');

    } catch (err) {
      console.error('Error saving to DB:', err);
    }
  }
});

bot.launch().then(() => {
  console.log('Socientic AI Bot is live!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
