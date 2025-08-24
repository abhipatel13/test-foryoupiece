import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const adminKey = process.env.ADMIN_API_KEY
    const authHeader = request.headers.get('authorization')

    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

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

    const { data: stats } = await supabase
      .from('email_outbox')
      .select('status, count:count(*)')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .group('status')

    return NextResponse.json({ success: true, stats })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}

