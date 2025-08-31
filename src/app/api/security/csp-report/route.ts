import { NextRequest, NextResponse } from 'next/server'

// Lightweight CSP violation report collector.
// Use report-uri or report-to to send violation reports here.
// Keeps minimal processing and returns 204 to avoid noise.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(async () => ({ text: await request.text() }))
    console.warn('🛡️ CSP Violation Report', {
      path: request.nextUrl.pathname,
      referer: request.headers.get('referer') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      report: body,
      ts: new Date().toISOString(),
    })
  } catch (e) {
    try { console.warn('🛡️ CSP Violation Report (unparseable)') } catch {}
  }
  return new NextResponse(null, { status: 204 })
}

export async function GET() {
  return NextResponse.json({ success: true, message: 'CSP report endpoint active' })
}

