import { NextResponse } from 'next/server';

interface TelegramUpdate {
  message?: {
    text?: string;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
    };
  };
}

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json();
    const BOT_TOKEN = process.env.TELEGRAM_AUTH_BOT_TOKEN;
    const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME || 'Authenticationfypbot';
    const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://foryoupiece.com';
    
    if (!BOT_TOKEN) {
      console.error('❌ TELEGRAM_AUTH_BOT_TOKEN not configured');
      return NextResponse.json({ ok: true });
    }
    
    console.log('📨 Telegram webhook received:', JSON.stringify(update, null, 2));
    
    if (update.message?.text?.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const user = update.message.from;
      
      // Extract request ID if present
      const requestId = update.message.text.split(' ')[1];
      console.log('🔑 Login request ID:', requestId);
      
      // Create inline keyboard with LoginUrl button
      const keyboard = {
        inline_keyboard: [[
          {
            text: '🔐 Login to Foryoupiece',
            login_url: {
              url: `${WEBSITE_URL}/en/auth/login`,
              forward_text: 'Login to Foryoupiece',
              bot_username: BOT_USERNAME,
              request_write_access: false
            }
          }
        ]]
      };
      
      // Send message with login button
      const messageResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Welcome ${user.first_name}! 👋\n\n🛍️ Click the button below to securely login to Foryoupiece and start shopping for premium Japanese products:`,
          reply_markup: keyboard,
          parse_mode: 'HTML'
        })
      });
      
      const messageResult = await messageResponse.json();
      console.log('📤 Message sent result:', messageResult);
      
      if (!messageResponse.ok) {
        console.error('❌ Failed to send message:', messageResult);
      } else {
        console.log('✅ Login button sent successfully to user:', user.id);
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

// Handle GET requests for webhook verification
export async function GET(request: Request) {
  return NextResponse.json({ 
    status: 'Telegram webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
