import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME || 'Authenticationfypbot';
    const WEBSITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://foryoupiece.com';
    
    // Create a unique login request ID
    const requestId = `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // The callback URL where Telegram will send the user after auth
    const callbackUrl = `${WEBSITE_URL}/en/auth/login`;
    
    // Create deep link to Telegram bot with login request
    const loginUrl = `https://t.me/${BOT_USERNAME}?start=${requestId}`;
    
    console.log('🔗 Generated Telegram login URL:', loginUrl);
    console.log('📝 Request ID:', requestId);
    console.log('🔄 Callback URL:', callbackUrl);
    
    // Store the request ID in your database if needed for tracking
    // await storeLoginRequest(requestId, callbackUrl);
    
    return NextResponse.json({ 
      loginUrl,
      requestId,
      callbackUrl
    });
  } catch (error) {
    console.error('❌ Failed to generate login URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate login URL' },
      { status: 500 }
    );
  }
}
