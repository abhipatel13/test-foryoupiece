import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { generateDailyRecommendations } from '@/lib/services/recommendations-admin'

// Helper to normalize a value to 0..1
function normalize(value: number, min: number, max: number): number {
  if (!isFinite(value) || !isFinite(min) || !isFinite(max) || max <= min) return 0
  const n = (value - min) / (max - min)
  return Math.max(0, Math.min(1, n))
}

function todayDateString(): string {
  // Use UTC date for consistency
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json().catch(() => ({}))
  const refreshType = body?.refresh_type || 'manual'
  try {
    const { generateDailyRecommendations } = await import('@/lib/services/recommendations-admin')
    const result = await generateDailyRecommendations(refreshType)
    return NextResponse.json({ success: true, ...result, refresh_type: refreshType })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
})

