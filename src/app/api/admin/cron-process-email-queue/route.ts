import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Lightweight GET endpoint for Vercel Cron to trigger processing
// Calls the existing POST /api/admin/process-email-queue under the hood
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    // Use internal fetch to call the processor
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://foryoupiece.com'
    const resp = await fetch(`${base}/api/admin/process-email-queue`, {
      method: 'POST',
      // prevent any edge cache
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await resp.json().catch(() => ({}))

    return NextResponse.json({
      success: resp.ok,
      status: resp.status,
      data,
      timestamp: new Date().toISOString(),
    }, { status: resp.ok ? 200 : 500 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Optional POST passthrough for manual triggers
export async function POST(req: NextRequest) {
  return GET(req)
}

