import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

function getFunctionsBaseUrl() {
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const m = supa.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)
  const ref = m?.[1]
  if (!ref) return null
  return `https://${ref}.functions.supabase.co`
}

export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}))
    const triggeredBy = body?.triggeredBy || 'admin_ui'

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('boxhero_sync_jobs')
      .insert({ status: 'queued', triggered_by: triggeredBy })
      .select('*')
      .single()

    if (error || !data) return NextResponse.json({ success: false, error: error?.message || 'enqueue failed' }, { status: 500 })

    const base = getFunctionsBaseUrl()
    if (!base) return NextResponse.json({ success: false, error: 'invalid functions base url' }, { status: 500 })

    const fnUrl = `${base}/boxhero-sync-worker`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
    // Await initial invocation to avoid it being dropped by the platform tear-down
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 6000)
    try {
      const resp = await fetch(fnUrl, { method: 'POST', headers, body: JSON.stringify({ job_id: data.id }), signal: controller.signal })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        console.warn('boxhero-sync-worker initial invoke returned non-2xx', resp.status, txt)
      }
    } catch (e) {
      console.warn('boxhero-sync-worker initial invoke error', e)
    } finally {
      clearTimeout(t)
    }

    return NextResponse.json({ success: true, job: { id: data.id, status: data.status } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown error' }, { status: 500 })
  }
})
