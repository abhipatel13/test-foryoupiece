import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Minimal Resend integration via REST API (no SDK dependency)
 * - Uses RESEND_API_KEY
 * - Uses RESEND_FROM_EMAIL and optional RESEND_FROM_NAME
 * - In development or preview, optionally override recipient to a single test address
 * - Supports RESEND_OVERRIDE_ALL_TO to force routing in any environment
 */

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  emailType?: string // for logging (e.g., 'order_confirmation')
  metadata?: Record<string, any>
}

const RESEND_API_URL = 'https://api.resend.com/emails'

function getEnv(name: string, fallback?: string) {
  const v = process.env[name]
  return v && v.length > 0 ? v : fallback
}

const FROM_EMAIL = getEnv('RESEND_FROM_EMAIL') || 'no-reply@foryoupiece.com'
const FROM_NAME = getEnv('RESEND_FROM_NAME') || 'Foryoupiece'
const RESEND_API_KEY = getEnv('RESEND_API_KEY')
const DEV_EMAIL_OVERRIDE = getEnv('DEV_EMAIL_OVERRIDE', 'akito12350@gmail.com')
const FORCE_TO = getEnv('RESEND_OVERRIDE_ALL_TO')

export async function sendEmailViaResend(params: SendEmailParams): Promise<{ id?: string; success: boolean; status?: number; error?: string }>{
  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not configured')
    return { success: false, error: 'Missing RESEND_API_KEY' }
  }

  const supabase = typeof window === 'undefined' ? createServiceRoleClient() : null

  // Normalize recipients
  let recipients = Array.isArray(params.to) ? params.to : [params.to]

  // Global override (any environment)
  if (FORCE_TO) {
    recipients = [FORCE_TO]
  } else {
    // In non-production (consider Vercel Preview & local dev), route to dev/test address
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    if (!isProd && DEV_EMAIL_OVERRIDE) {
      recipients = [DEV_EMAIL_OVERRIDE]
    }
  }

  const payload: any = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: recipients,
    subject: params.subject,
    html: params.html,
  }
  if (params.text) payload.text = params.text

  try {
    const resp = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const status = resp.status
    const data = await resp.json().catch(() => ({}))

    const success = status >= 200 && status < 300

    // Log to email_logs if available
    try {
      if (supabase) {
        await supabase.from('email_logs').insert({
          recipient: recipients.join(','),
          subject: params.subject,
          email_type: params.emailType || 'generic',
          status: success ? 'sent' : 'failed',
          error_message: success ? null : (data?.error || `HTTP ${status}`),
          metadata: params.metadata || {},
          created_at: new Date().toISOString(),
        })
      }
    } catch (logErr) {
      console.warn('⚠️ Failed to log email attempt:', logErr)
    }

    if (!success) {
      console.error('❌ Resend send failed:', status, data)
      return { success: false, status, error: data?.error || `HTTP ${status}` }
    }

    return { success: true, status, id: data?.id }
  } catch (err: any) {
    console.error('❌ Resend send error:', err)
    try {
      if (supabase) {
        await supabase.from('email_logs').insert({
          recipient: Array.isArray(params.to) ? params.to.join(',') : params.to,
          subject: params.subject,
          email_type: params.emailType || 'generic',
          status: 'failed',
          error_message: err?.message || 'Unknown error',
          metadata: params.metadata || {},
          created_at: new Date().toISOString(),
        })
      }
    } catch {}
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

