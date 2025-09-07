import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  const botToken = (
    process.env.TELEGRAM_STAFF_HELPER_BOT_TOKEN ||
    process.env.TELEGRAM_QUERIESBOT_TOKEN ||
    process.env.TELEGRAM_QUERIES_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  ).trim()

  const adminGroupId = (process.env.STAFF_HELPER_ADMIN_GROUP_ID || process.env.ADMIN_GROUP_ID || '').trim()
  const adminThreadId = (process.env.STAFF_HELPER_ADMIN_THREAD_ID || process.env.ADMIN_THREAD_ID || '1519').trim()
  const teamGroupId = (process.env.STAFF_HELPER_TEAM_GROUP_ID || process.env.TEAM_GROUP_ID || '').trim()
  const teamThreadId = (process.env.STAFF_HELPER_TEAM_THREAD_ID || process.env.TEAM_THREAD_ID || '1521').trim()

  const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || 'foryoupiece-webhook-secret').trim()
  const openrouterEnabled = !!process.env.OPENROUTER_API_KEY
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const catalogBase = process.env.CATALOG_API_BASE || null

  // Return only safe booleans/identifiers; no secrets exposed
  return NextResponse.json({
    ok: true,
    data: {
      hasToken: Boolean(botToken),
      openrouterEnabled,
      hasWebhookSecret: Boolean(webhookSecret),
      hasServiceRole,
      catalogBaseConfigured: Boolean(catalogBase),
      allowedThreads: {
        admin: { hasGroupId: Boolean(adminGroupId), threadId: adminThreadId },
        team: { hasGroupId: Boolean(teamGroupId), threadId: teamThreadId }
      }
    },
    ts: new Date().toISOString()
  })
}

