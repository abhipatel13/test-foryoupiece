import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/admin-middleware'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const GET = withAdminAuth(async (_req: NextRequest, _ctx: { user: any; adminUser: any }, { params }: { params: { id: string } }) => {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('boxhero_sync_jobs')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || 'job not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, job: data })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown error' }, { status: 500 })
  }
})
