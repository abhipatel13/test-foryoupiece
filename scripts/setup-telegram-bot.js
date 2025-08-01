// CRITICAL: Bot setup script (run once)
// This script configures the Telegram bot for LoginUrl authentication

const BOT_TOKEN = process.env.TELEGRAM_AUTH_BOT_TOKEN;
const WEBHOOK_URL = 'https://foryoupiece.com/api/telegram/webhook';
const BOT_USERNAME = 'Authenticationfypbot';

async function setupBot() {
  if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_AUTH_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('🤖 Setting up Telegram bot for LoginUrl authentication...');
  console.log('📝 Bot Username:', BOT_USERNAME);
  console.log('🔗 Webhook URL:', WEBHOOK_URL);

  try {
    // 1. Set webhook
    console.log('\n1️⃣ Setting webhook...');
    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          allowed_updates: ['message', 'callback_query']
        })
      }
    );
    
    const webhookResult = await webhookResponse.json();
    console.log('✅ Webhook result:', webhookResult);
    
    // 2. Set bot commands
    console.log('\n2️⃣ Setting bot commands...');
    const commandsResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'start', description: 'Start authentication process' },
            { command: 'login', description: 'Login to Foryoupiece' },
            { command: 'help', description: 'Get help with authentication' }
          ]
        })
      }
    );
    
    const commandsResult = await commandsResponse.json();
    console.log('✅ Commands result:', commandsResult);
    
    // 3. Get bot info
    console.log('\n3️⃣ Getting bot information...');
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    
    const botInfo = await botInfoResponse.json();
    console.log('🤖 Bot info:', botInfo);
    
    // 4. Test webhook
    console.log('\n4️⃣ Testing webhook...');
    const webhookInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    
    const webhookInfo = await webhookInfoResponse.json();
    console.log('🔗 Webhook info:', webhookInfo);
    
    console.log('\n✅ Bot setup completed successfully!');
    console.log('\n🚨 IMPORTANT MANUAL STEPS:');
    console.log('1. Message @BotFather on Telegram');
    console.log('2. Send: /setdomain');
    console.log(`3. Select: @${BOT_USERNAME}`);
    console.log('4. Enter: foryoupiece.com');
    console.log('\n💡 This domain setting is CRITICAL for LoginUrl buttons to work!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupBot();
