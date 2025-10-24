import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

function extractProjectRef(url?: string | null) {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname
    const parts = host.split('.')
    // standard host: <ref>.supabase.co
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'co') {
      return parts[0]
    }
    return null
  } catch {
    return null
  }
}

function getInvokeTimeoutMs() {
  const fromEnv = Number(process.env.FYP_WORKER_INVOKE_TIMEOUT_MS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv)
  // Dev: allow longer cold start
  if (process.env.NODE_ENV !== 'production') return 12_000
  return 6_000
}

function getFunctionsBaseUrl() {
  const override = (process.env.SUPABASE_FUNCTIONS_URL || '').trim()
  if (override) {
    return override.replace(/\/$/, '')
  }
  const ref =
    extractProjectRef(process.env.SUPABASE_URL) ||
    extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    (process.env.SUPABASE_PROJECT_REF || null)
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
    if (!base) {
      console.warn('enqueue: invalid functions base url', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasProjectRef: !!process.env.SUPABASE_PROJECT_REF,
        hasFunctionsUrl: !!process.env.SUPABASE_FUNCTIONS_URL,
      })
      return NextResponse.json({ success: false, error: 'invalid functions base url' }, { status: 500 })
    }

    const fnUrl = `${base}/boxhero-sync-worker`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
    // Await initial invocation briefly to ensure dispatch; timeout is configurable
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), getInvokeTimeoutMs())
    try {
      // Use a small budget for the first invoke so the function returns quickly but starts processing
      const resp = await fetch(fnUrl, { method: 'POST', headers, body: JSON.stringify({ job_id: data.id, budget_ms: 500 }), signal: controller.signal })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        console.warn('boxhero-sync-worker initial invoke returned non-2xx', resp.status, txt)
        // Mark job as failed to avoid indefinite queued state when worker env/secrets are missing
        await supabase
          .from('boxhero_sync_jobs')
          .update({ status: 'failed', error: `initial invoke failed: ${resp.status} ${txt?.slice(0,300)}` })
          .eq('id', data.id)
      }
    } catch (e: any) {
      console.warn('boxhero-sync-worker initial invoke error', e)
      // If the error is an AbortError (timeout), don't fail the job; worker may still start or a retry may succeed
      if (e?.name !== 'AbortError') {
        await supabase
          .from('boxhero_sync_jobs')
          .update({ status: 'failed', error: `initial invoke error: ${e?.message || 'unknown'}` })
          .eq('id', data.id)
      }
    } finally {
      clearTimeout(t)
    }

    return NextResponse.json({ success: true, job: { id: data.id, status: data.status } })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown error' }, { status: 500 })
  }
})
