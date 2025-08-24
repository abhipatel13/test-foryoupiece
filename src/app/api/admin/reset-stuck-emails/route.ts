import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Admin endpoint to reset stale processing emails (>10 minutes) back to failed.
 * GET/POST /api/admin/reset-stuck-emails
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withAdminAuth(async (_req: NextRequest) => {
  try {
    const supabase = createServiceRoleClient()

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    // Reset processing rows older than 10 minutes
    const { error: updateError } = await supabase
      .from('email_outbox')
      .update({
        status: 'failed',
        next_retry_at: new Date().toISOString(),
        error_message: 'lease expired',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('updated_at', tenMinutesAgo)

    if (updateError) throw new Error(updateError.message)

    // Return counts by status for visibility (last 24h)
    const { data: stats } = await supabase
      .from('email_outbox')
      .select('status, count:count(*)')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .group('status')

    return NextResponse.json({ success: true, stats })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
})

export const GET = withAdminAuth(async (req: NextRequest) => {
  return POST(req as any)
})

