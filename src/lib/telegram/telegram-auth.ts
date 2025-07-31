import crypto from 'crypto'

// Telegram Bot configuration
export const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_AUTH_BOT_TOKEN || '',
  botUsername: process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME || '',
  botId: process.env.NEXT_PUBLIC_TELEGRAM_AUTH_BOT_ID || '8066090295',
  domain: process.env.NEXT_PUBLIC_SITE_URL ?
    new URL(process.env.NEXT_PUBLIC_SITE_URL).host :
    'foryoupiece.com'
}

// Telegram user data interface
export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

// Verify Telegram authentication data
export function verifyTelegramAuth(data: TelegramUser): boolean {
  if (!TELEGRAM_CONFIG.botToken) {
    console.error('Telegram bot token not configured')
    return false
  }

  const { hash, ...authData } = data
  
  // Create data check string
  const dataCheckString = Object.keys(authData)
    .sort()
    .map(key => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n')
  
  // Create secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(TELEGRAM_CONFIG.botToken)
    .digest()
  
  // Create hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')
  
  // Verify hash
  if (calculatedHash !== hash) {
    console.error('Telegram auth hash verification failed')
    return false
  }
  
  // Check auth date (should be within 24 hours)
  const authDate = new Date(data.auth_date * 1000)
  const now = new Date()
  const timeDiff = now.getTime() - authDate.getTime()
  const hoursDiff = timeDiff / (1000 * 60 * 60)
  
  if (hoursDiff > 24) {
    console.error('Telegram auth data is too old')
    return false
  }
  
  return true
}

// Generate Telegram login URL
export function generateTelegramLoginUrl(redirectUrl?: string): string {
  const baseUrl = 'https://oauth.telegram.org/auth'

  // Get origin safely for SSR compatibility
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : `https://${TELEGRAM_CONFIG.domain}`

  const params = new URLSearchParams({
    bot_id: TELEGRAM_CONFIG.botId,
    origin: TELEGRAM_CONFIG.domain,
    request_access: 'write',
    return_to: redirectUrl || `${origin}/en/auth/callback`
  })

  return `${baseUrl}?${params.toString()}`
}

// Telegram Login Widget Script
export function loadTelegramWidget(
  containerId: string,
  onAuth: (user: TelegramUser) => void,
  options: {
    size?: 'large' | 'medium' | 'small'
    corner_radius?: number
    request_access?: 'write'
    lang?: string
  } = {}
) {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('Telegram widget can only be loaded in browser environment')
    return
  }

  // Remove existing widget
  const existingWidget = document.getElementById('telegram-login-widget')
  if (existingWidget) {
    existingWidget.remove()
  }
  
  // Create script element
  const script = document.createElement('script')
  script.id = 'telegram-login-widget'
  script.async = true
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.setAttribute('data-telegram-login', TELEGRAM_CONFIG.botUsername)
  script.setAttribute('data-size', options.size || 'large')
  script.setAttribute('data-corner-radius', (options.corner_radius || 10).toString())
  script.setAttribute('data-request-access', options.request_access || 'write')
  script.setAttribute('data-lang', options.lang || 'en')
  script.setAttribute('data-onauth', 'onTelegramAuth(user)')
  
  // Add global callback function
  ;(window as any).onTelegramAuth = (user: TelegramUser) => {
    if (verifyTelegramAuth(user)) {
      onAuth(user)
    } else {
      console.error('Telegram authentication verification failed')
    }
  }
  
  // Append to container
  const container = document.getElementById(containerId)
  if (container) {
    container.appendChild(script)
  } else {
    console.error(`Container with id "${containerId}" not found`)
  }
}

// Clean up Telegram widget
export function cleanupTelegramWidget() {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const widget = document.getElementById('telegram-login-widget')
  if (widget) {
    widget.remove()
  }

  // Remove global callback
  if ((window as any).onTelegramAuth) {
    delete (window as any).onTelegramAuth
  }
}

// Convert Telegram user to our user format
export function convertTelegramUser(telegramUser: TelegramUser) {
  return {
    telegram_id: telegramUser.id.toString(),
    telegram_username: telegramUser.username || null,
    first_name: telegramUser.first_name,
    last_name: telegramUser.last_name || null,
    avatar_url: telegramUser.photo_url || null,
    email: null, // Telegram doesn't provide email
    phone: null, // Telegram doesn't provide phone by default
    auth_provider: 'telegram' as const
  }
}
