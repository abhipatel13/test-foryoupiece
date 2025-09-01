import { NextRequest, NextResponse } from 'next/server'
import { generateDailyRecommendations } from '@/lib/services/recommendations-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Basic guard: allow when called by Vercel Cron or with CRON_SECRET
    const vercelCron = request.headers.get('x-vercel-cron')
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret') || request.headers.get('x-cron-key')

    if (!vercelCron && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const result = await generateDailyRecommendations('scheduled')

    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

