import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Admin-only Telegram Environment Check
 * GET /api/admin/telegram/env-check
 * Returns safe information verifying TELEGRAM_BOT_TOKEN/TELEGRAM_AUTH_BOT_TOKEN and bot identities
 */
export const GET = withAdminAuth(async (_request: NextRequest) => {
  try {
    const notifToken = process.env.TELEGRAM_BOT_TOKEN
    const authToken = process.env.TELEGRAM_AUTH_BOT_TOKEN

    async function check(token?: string) {
      if (!token) return { configured: false }
      const prefix = token.split(':')[0]
      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`)
        const data = await resp.json()
        if (data.ok) {
          const id = String(data.result.id)
          const username = data.result.username
          return {
            configured: true,
            tokenIdPrefix: prefix,
            id,
            username,
            isAuthBot: id === '8066090295'
          }
        } else {
          return { configured: true, tokenIdPrefix: prefix, error: data.description || 'getMe failed' }
        }
      } catch (e: any) {
        return { configured: true, tokenIdPrefix: prefix, error: e?.message || 'Network error calling getMe' }
      }
    }

    const notification = await check(notifToken)
    const authentication = await check(authToken)

    return NextResponse.json({ success: true, notification, authentication })
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
})

