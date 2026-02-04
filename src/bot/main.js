const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const supabase = require('../db');
const { generateSolanaWallet, generateBaseWallet } = require('../utils/wallets');
const PaperTrader = require('../models/paper_trader');
const { getTokenData } = require('../utils/onchain');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Basic logging for development
bot.use(async (ctx, next) => {
  const messageText = ctx.message?.text || '[non-text message]';
  const username = ctx.from?.username || 'unknown';
  console.log(`[${new Date().toISOString()}] Message from ${ctx.from?.id} (${username}): ${messageText}`);
  return next();
});

// Menu Handler (Smart)
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  
  // Check if user exists
  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', userId).single();
  const hasAgent = user && (user.wallet_sol_pub || user.wallet_base_pub);

  if (hasAgent) {
    // EXISTING USER MENU
    ctx.reply(`**Welcome back, ${ctx.from.first_name}!** 🥧\n\nYour Agent is active. Manage it below:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Fund Wallets', callback_data: 'fund_wallets' },
            { text: '📡 Data Feeds', callback_data: 'view_feeds' }
          ],
          [
            { text: '🗣 Give Opinion', callback_data: 'give_opinion' },
            { text: '📊 Dashboard', callback_data: 'check_status' }
          ]
        ]
      }
    });
  } else {
    // NEW USER MENU
    ctx.reply('**Welcome to Socientic AI** 🥧\n\nChoose an option below:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 Spawn Trading Bot', callback_data: 'spawn_bot' },
            { text: '🎁 Contribute Data (Airdrop)', callback_data: 'contribute_data' }
          ]
        ]
      }
    });
  }
});

// Action: Fund Wallets (Show Addresses)
bot.action('fund_wallets', async (ctx) => {
  const userId = ctx.from.id.toString();
  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', userId).single();
  
  if (!user) return ctx.reply('Error finding user.');

  let msg = `💰 **Funding Wallets**\n\n`;
  if (user.wallet_sol_pub) msg += `🟣 **Solana:**\n\`${user.wallet_sol_pub}\`\n\n`;
  if (user.wallet_base_pub) msg += `🔵 **Base:**\n\`${user.wallet_base_pub}\`\n\n`;
  msg += `Send funds to start trading.`;

  ctx.reply(msg, { parse_mode: 'Markdown' });
});

// Action: Give Opinion (Instruction)
bot.action('give_opinion', (ctx) => {
  ctx.reply('Just type your thoughts here! I am listening. \n\nExample: "I think $SOL is going to 200" or "@influencer is smart".');
});

// Action: View Feeds (Mock)
bot.action('view_feeds', (ctx) => {
  ctx.reply('📡 **Active Data Feeds**\n\n• Group: AlphaCallers (Live)\n• Group: GemHunters (Live)\n\n*Go to Dashboard to add more.*');
});


// Action: Spawn Bot (Selection)
bot.action('spawn_bot', (ctx) => {
  ctx.reply('Select your trading network:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🟣 Solana (SOL)', callback_data: 'spawn_sol' }],
        [{ text: '🔵 Base (ETH)', callback_data: 'spawn_base' }]
      ]
    }
  });
});

// Action: Create Wallet (Dual Generation)
async function handleWalletCreation(ctx, preferredNetwork) {
  const userId = ctx.from.id.toString();
  
  // Check existing
  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', userId).single();
  
  // If user has the PREFERRED wallet already, show it
  if (user && (preferredNetwork === 'SOL' ? user.wallet_sol_pub : user.wallet_base_pub)) {
    return ctx.reply(`You already have a ${preferredNetwork} agent wallet!`, { parse_mode: 'Markdown' });
  }

  // Generate BOTH wallets regardless of choice
  const solKeypair = generateSolanaWallet();
  const baseKeypair = generateBaseWallet();

  // Save both to DB
  await supabase.from('users').upsert({ 
    telegram_id: userId, 
    username: ctx.from.username,
    wallet_sol_pub: solKeypair.address, 
    wallet_sol_priv: solKeypair.privateKey, 
    wallet_base_pub: baseKeypair.address, 
    wallet_base_priv: baseKeypair.privateKey 
  }, { onConflict: 'telegram_id' });

  // Display ONLY the preferred one (focus), but mention the other exists
  const mainWallet = preferredNetwork === 'SOL' ? solKeypair.address : baseKeypair.address;
  const mainPriv = preferredNetwork === 'SOL' ? solKeypair.privateKey : baseKeypair.privateKey;
  
  ctx.reply(
    `✅ **Agent Initialized (${preferredNetwork})**\n\n` +
    `**Public Address:** \`${mainWallet}\`\n\n` +
    `**🔑 Private Key (SAVE NOW):**\n\`${mainPriv}\`\n\n` +
    `_Hidden: A ${preferredNetwork === 'SOL' ? 'Base' : 'Solana'} wallet was also created for you. Check /status to reveal it._\n\n` +
    `**Next:** Fund this wallet with **${preferredNetwork === 'SOL' ? 'SOL' : 'ETH'}** + **USDC** to start.`,
    { parse_mode: 'Markdown' }
  );
}

bot.action('spawn_sol', (ctx) => handleWalletCreation(ctx, 'SOL'));
bot.action('spawn_base', (ctx) => handleWalletCreation(ctx, 'BASE'));

// Action: Contribute Data
bot.action('contribute_data', (ctx) => {
  ctx.reply(
    `🎁 **Data Contribution & Airdrop**\n\n` +
    `Earn **$SOC** points by feeding data to the Hive Mind.\n\n` +
    `**Method 1: Live Tracking (Best)**\n` +
    `1. Add me to your Telegram Group.\n` +
    `2. Promote me to Admin (so I can read messages).\n` +
    `3. I will automatically track scans and credit you!\n\n` +
    `**Method 2: Historical Data**\n` +
    `1. Export your Group Chat History (JSON).\n` +
    `2. Upload it on your Dashboard (Link coming soon).\n` +
    `3. Enter the Group Name to match it.`
  );
});

// Action: Status
bot.action('check_status', async (ctx) => {
    ctx.reply('Fetching your stats...');
});

// General Chat Handler (Passive Opinion Logger)
bot.on('text', async (ctx) => {
  // If it's a command, ignore
  if (ctx.message.text.startsWith('/')) return;

  // If it's a DM, treat as conversational feedback
  if (ctx.chat.type === 'private') {
    const text = ctx.message.text;
    console.log(`[Opinion] User ${ctx.from.username}: ${text}`);
    
    // Save to DB with "Pending Weight" (to be calculated based on user's win rate later)
    await supabase.from('conversations').insert({
      user_id: ctx.from.id.toString(),
      message: text,
      context: 'user_opinion',
      tags: ['sentiment_data'] 
    });

    // Passive acknowledgment
    ctx.reply('Opinion logged. 📝');
    return;
  }

  // If Group, run the Scan Logic (Existing code)
  const text = ctx.message.text;
  
  // Look for CA-like strings (0x... or Solana-like base58 strings - usually 32-44 chars)
  const caRegex = /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const cas = text.match(caRegex) || [];
  
  // Look for $TICKER
  const tickerRegex = /\$[A-Z]{2,10}/g;
  const tickers = text.match(tickerRegex) || [];

  if (cas.length > 0 || tickers.length > 0) {
    console.log(`Found potential signals: CAs: ${cas}, Tickers: ${tickers}`);

    try {
      // 1. Upsert User
      if (ctx.from) {
        const { error: userError } = await supabase.from('users').upsert({
          telegram_id: ctx.from.id.toString(),
          username: ctx.from.username || null,
          first_name: ctx.from.first_name || null
        }, { onConflict: 'telegram_id' });

        if (userError) console.error('Error upserting user:', userError);
      }

      // 2. Upsert Group (if applicable)
      let groupId = null;
      if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
        groupId = ctx.chat.id.toString();
        
        const { error: groupError } = await supabase.from('groups').upsert({
          telegram_id: groupId,
          title: ctx.chat.title || null,
          type: ctx.chat.type
        }, { onConflict: 'telegram_id' });
        
        if (groupError) console.error('Error upserting group:', groupError);
      }

      // 3. Insert Scans
      const timestamp = Math.floor(Date.now() / 1000);
      const userId = ctx.from ? ctx.from.id.toString() : null;

      const scansToInsert = [];

      for (const ca of cas) {
        let mcap = null;
        let liquidity = null;
        let pairAge = null;

        try {
          const tokenData = await getTokenData(ca);
          if (tokenData) {
            mcap = tokenData.mcap;
            liquidity = tokenData.liquidity;
            pairAge = tokenData.pair_age;
          }
        } catch (err) {
          console.error(`Failed to enrich token data for ${ca}:`, err);
        }

        scansToInsert.push({
          user_id: userId,
          group_id: groupId,
          ticker: null,
          ca: ca,
          timestamp: timestamp,
          mcap: mcap,
          liquidity: liquidity,
          pair_age: pairAge
        });
      }

      for (const ticker of tickers) {
        scansToInsert.push({
          user_id: userId,
          group_id: groupId,
          ticker: ticker,
          ca: null,
          timestamp: timestamp
        });
      }

      if (scansToInsert.length > 0) {
        const { error: scanError } = await supabase.from('scans').insert(scansToInsert);
        if (scanError) {
          console.error('Error inserting scans:', scanError);
        } else {
          console.log(`Saved ${scansToInsert.length} scans to database.`);

          // --- Paper Trader Trigger ---
          const notifyAdmin = async (msg) => {
            try {
                // Find @alpham3o
                const { data: user } = await supabase.from('users').select('telegram_id').eq('username', 'alpham3o').single();
                if (user && user.telegram_id) {
                    bot.telegram.sendMessage(user.telegram_id, msg).catch(e => console.error('Failed to send DM:', e));
                } else {
                    console.log('Paper Trader Alert (Admin not found):', msg);
                }
            } catch (e) { console.error('Notify Error:', e); }
          };

          for (const scan of scansToInsert) {
              PaperTrader.processScan(scan, notifyAdmin);
          }
          // ---------------------------
        }
      }

    } catch (err) {
      console.error('Error saving to DB:', err);
    }
  }
});

// Paper Trader: Periodic Sell Check (Every 60s)
setInterval(() => {
    const notifyAdmin = async (msg) => {
        try {
            const { data: user } = await supabase.from('users').select('telegram_id').eq('username', 'alpham3o').single();
            if (user && user.telegram_id) {
                bot.telegram.sendMessage(user.telegram_id, msg).catch(e => console.error('Failed to send DM:', e));
            } else {
                console.log('Paper Trader Sell Alert:', msg);
            }
        } catch (e) { console.error('Notify Error:', e); }
    };
    PaperTrader.checkOpenTrades(notifyAdmin);
}, 60000);

bot.launch().then(() => {
  console.log('Socientic AI Bot is live!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
