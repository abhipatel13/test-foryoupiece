import { NextRequest, NextResponse } from 'next/server'

/**
 * Telegram OAuth Callback Handler
 * This endpoint receives the redirect from Telegram OAuth
 * and processes the authentication data
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Telegram OAuth callback received')
    
    const url = new URL(request.url)
    const searchParams = url.searchParams
    
    // Extract Telegram authentication data from URL parameters
    const telegramData = {
      id: searchParams.get('id'),
      first_name: searchParams.get('first_name'),
      last_name: searchParams.get('last_name'),
      username: searchParams.get('username'),
      photo_url: searchParams.get('photo_url'),
      auth_date: searchParams.get('auth_date'),
      hash: searchParams.get('hash')
    }
    
    console.log('📥 Telegram data received:', {
      id: telegramData.id,
      first_name: telegramData.first_name,
      username: telegramData.username,
      hasHash: !!telegramData.hash,
      hasAuthDate: !!telegramData.auth_date
    })
    
    // Validate required fields
    if (!telegramData.id || !telegramData.first_name || !telegramData.hash || !telegramData.auth_date) {
      console.error('❌ Missing required Telegram data')
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">Authentication Error</h1>
          <p>Missing required authentication data from Telegram.</p>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'telegram-auth-error', error: 'Missing required data' }, '*');
                window.close();
              }
            }, 1000);
          </script>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // Convert string values to appropriate types
    const processedData = {
      id: parseInt(telegramData.id!),
      first_name: telegramData.first_name!,
      last_name: telegramData.last_name || undefined,
      username: telegramData.username || undefined,
      photo_url: telegramData.photo_url || undefined,
      auth_date: parseInt(telegramData.auth_date!),
      hash: telegramData.hash!
    }
    
    console.log('🔄 Processed Telegram data:', processedData)
    
    // Return HTML page that will communicate with parent window
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Telegram Authentication</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f8f9fa;
          }
          .success { color: #27ae60; }
          .loading { color: #3498db; }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h1 class="loading">Completing Authentication...</h1>
        <p>Please wait while we sign you in.</p>
        
        <script>
          console.log('🎯 Telegram callback page loaded');
          
          const telegramData = ${JSON.stringify(processedData)};
          console.log('📤 Sending Telegram data to parent:', telegramData);
          
          // Send data to parent window (the popup opener)
          if (window.opener) {
            window.opener.postMessage({
              type: 'telegram-auth-success',
              user: telegramData
            }, '*');
            
            // Close popup after sending data
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            console.error('❌ No opener window found');
            document.body.innerHTML = '<h1 class="error">Error: No parent window found</h1>';
          }
        </script>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
    
  } catch (error) {
    console.error('❌ Telegram callback error:', error)
    
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1 class="error">Authentication Error</h1>
        <p>An error occurred during authentication.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'telegram-auth-error', 
              error: 'Authentication failed' 
            }, '*');
            window.close();
          }
        </script>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}
