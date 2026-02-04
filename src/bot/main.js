const { Telegraf } = require('telegraf');
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

// Menu Handler
bot.start((ctx) => {
  ctx.reply('**Welcome to Socientic AI** 🥧\n\nChoose an option below:', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🤖 Spawn Trading Bot', callback_data: 'spawn_bot' },
          { text: '🎁 Contribute Data (Airdrop)', callback_data: 'contribute_data' }
        ],
        [
          { text: '📊 My Dashboard', callback_data: 'check_status' }
        ]
      ]
    }
  });
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

// Action: Create Wallet
async function handleWalletCreation(ctx, network) {
  const userId = ctx.from.id.toString();
  
  // Check existing
  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', userId).single();
  
  if (user && (network === 'SOL' ? user.wallet_sol_pub : user.wallet_base_pub)) {
    return ctx.reply(`You already have a ${network} agent wallet!\nAddress: \`${network === 'SOL' ? user.wallet_sol_pub : user.wallet_base_pub}\``, { parse_mode: 'Markdown' });
  }

  let wallet, privKey;
  if (network === 'SOL') {
    const keypair = generateSolanaWallet();
    wallet = keypair.address;
    privKey = keypair.privateKey;
    await supabase.from('users').upsert({ telegram_id: userId, wallet_sol_pub: wallet, wallet_sol_priv: privKey }, { onConflict: 'telegram_id' });
  } else {
    const keypair = generateBaseWallet();
    wallet = keypair.address;
    privKey = keypair.privateKey;
    await supabase.from('users').upsert({ telegram_id: userId, wallet_base_pub: wallet, wallet_base_priv: privKey }, { onConflict: 'telegram_id' });
  }

  const nativeToken = network === 'SOL' ? 'SOL' : 'ETH';
  
  ctx.reply(
    `✅ **${network} Agent Created!**\n\n` +
    `**Your Wallet:**\n\`${wallet}\`\n\n` +
    `**⚠️ REQUIRED FUNDING:**\n` +
    `1. Send **${nativeToken}** (Trading Capital + Gas)\n` +
    `2. Send **USDC** (To pay for AI Compute/API Fees)\n\n` +
    `**Next Steps:**\n` +
    `• Add me to your Group Chat to feed me data.\n` +
    `• OR Go to the Dashboard to search for existing groups to opt-in.\n` +
    `• You can chat with me here anytime!`,
    { parse_mode: 'Markdown' }
  );
}

bot.action('spawn_sol', (ctx) => handleWalletCreation(ctx, 'SOL'));
bot.action('spawn_base', (ctx) => handleWalletCreation(ctx, 'BASE'));

// General Chat Handler (Conversational Data)
bot.on('text', async (ctx) => {
  // If it's a command, ignore
  if (ctx.message.text.startsWith('/')) return;

  // If it's a DM, treat as conversational feedback
  if (ctx.chat.type === 'private') {
    const text = ctx.message.text;
    console.log(`[Conversation] User ${ctx.from.username}: ${text}`);
    
    // Save to DB
    await supabase.from('conversations').insert({
      user_id: ctx.from.id.toString(),
      message: text,
      context: 'dm_feedback'
    });

    // Simple acknowledgment (Mock AI)
    ctx.reply('Message received. I am analyzing this input for future trading decisions. 🧠');
    return;
  }

  // If Group, run the Scan Logic (Existing code)
  // ...


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
    // Reuse status logic
    ctx.reply('Fetching your stats...');
});


bot.help((ctx) => {
  ctx.reply('Commands:\n/start - Initialize the bot\n/spawn - Create your trading agent & wallets\n/status - Check your gas tank and active bots\n/track - Start tracking predictive power in this group (Admin only)');
});

bot.command('spawn', async (ctx) => {
  const userId = ctx.from.id.toString();
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;

  try {
    // Check if user exists and has wallets
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Row not found"
      console.error('Error fetching user:', fetchError);
      return ctx.reply('An error occurred while checking your profile.');
    }

    let solWallet, baseWallet;
    let solPriv, basePriv;

    if (user && user.wallet_sol_pub && user.wallet_base_pub) {
      // User already has wallets
      solWallet = user.wallet_sol_pub;
      baseWallet = user.wallet_base_pub;
      return ctx.reply(
        `You already have an active Agent! 🤖\n\n` +
        `**SOL Wallet:** \`${solWallet}\`\n` +
        `**BASE Wallet:** \`${baseWallet}\`\n\n` +
        `Send SOL/USDC to these addresses to fund your Agent.`,
        { parse_mode: 'Markdown' }
      );
    }

    // Generate new wallets
    const solKeypair = generateSolanaWallet();
    const baseKeypair = generateBaseWallet();

    solWallet = solKeypair.address;
    solPriv = solKeypair.privateKey;
    baseWallet = baseKeypair.address;
    basePriv = baseKeypair.privateKey;

    // Save to DB
    const { error: upsertError } = await supabase.from('users').upsert({
      telegram_id: userId,
      username: username,
      first_name: firstName,
      wallet_sol_pub: solWallet,
      wallet_sol_priv: solPriv,
      wallet_base_pub: baseWallet,
      wallet_base_priv: basePriv
    }, { onConflict: 'telegram_id' });

    if (upsertError) {
      console.error('Error saving wallets:', upsertError);
      return ctx.reply('Failed to spawn agent. Please try again.');
    }

    ctx.reply(
      `Agent Spawned! 🤖\n\n` +
      `Here are your unique deposit addresses:\n\n` +
      `**SOL (Solana):**\n\`${solWallet}\`\n\n` +
      `**BASE (EVM):**\n\`${baseWallet}\`\n\n` +
      `Send SOL or USDC to these addresses to fund your Agent.`,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error('Spawn error:', err);
    ctx.reply('An unexpected error occurred.');
  }
});

bot.command('status', async (ctx) => {
  const userId = ctx.from.id.toString();

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', userId)
      .single();

    if (error || !user || !user.wallet_sol_pub) {
      return ctx.reply('You haven\'t spawned an agent yet. Use /spawn to get started.');
    }

    // Mock Balances (TODO: Implement real RPC calls)
    const solBalance = (Math.random() * 2).toFixed(2);
    const baseBalance = (Math.random() * 0.1).toFixed(3);
    
    // Mock Win Rate (TODO: Fetch from scorer)
    const winRate = 'N/A'; 

    ctx.reply(
      `📊 **Agent Status**\n\n` +
      `**Balances:**\n` +
      `SOL: ${solBalance} SOL\n` +
      `BASE: ${baseBalance} ETH\n\n` +
      `**Performance:**\n` +
      `Win Rate: ${winRate}\n` +
      `Active Trades: 0`,
      { parse_mode: 'Markdown' }
    );

  } catch (err) {
    console.error('Status error:', err);
    ctx.reply('Could not fetch status.');
  }
});

// Listener for coin mentions
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (!text) return;

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
