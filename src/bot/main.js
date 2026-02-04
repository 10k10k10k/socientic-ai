const { Telegraf } = require('telegraf');
require('dotenv').config();
const supabase = require('../db');
const { generateSolanaWallet, generateBaseWallet } = require('../utils/wallets');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Basic logging for development
bot.use(async (ctx, next) => {
  const messageText = ctx.message?.text || '[non-text message]';
  const username = ctx.from?.username || 'unknown';
  console.log(`[${new Date().toISOString()}] Message from ${ctx.from?.id} (${username}): ${messageText}`);
  return next();
});

bot.start((ctx) => {
  ctx.reply(
    'Welcome to Socientic AI! 🥧\n\n' +
    'I am your primary hub for managing trading bots and tracking predictive power.\n\n' +
    '**🚀 Get Started:**\n' +
    '1. Add me to your group.\n' +
    '2. Use /spawn to create your trading wallet.\n\n' +
    '**📥 Import History (Instant Score):**\n' +
    'Don\'t want to wait? You can upload your group\'s history!\n' +
    '1. Desktop Telegram: Go to Group Settings -> Export Chat History -> **JSON Format**.\n' +
    '2. Upload the file on your Dashboard to backtest your group\'s calls immediately.'
  );
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
        scansToInsert.push({
          user_id: userId,
          group_id: groupId,
          ticker: null,
          ca: ca,
          timestamp: timestamp
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
        }
      }

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
