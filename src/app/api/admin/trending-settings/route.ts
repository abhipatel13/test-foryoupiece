import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { withAdminAuth } from '@/lib/auth/admin-middleware'

/**
 * Admin Trending Settings API Endpoint
 * GET /api/admin/trending-settings - Get trending system settings
 * PUT /api/admin/trending-settings - Update trending system settings
 */

export const GET = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    console.log('⚙️ Admin Trending Settings GET called')

    const supabase = createServiceRoleClient()

    const { data: settings, error } = await supabase
      .from('trending_system_settings')
      .select('*')
      .order('setting_key')

    if (error) {
      console.error('Error fetching trending settings:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch settings',
        details: error.message 
      }, { status: 500 })
    }

    // Convert to a more usable format
    const settingsMap: Record<string, any> = {}
    settings?.forEach(setting => {
      settingsMap[setting.setting_key] = {
        value: setting.setting_value,
        description: setting.description,
        updated_at: setting.updated_at
      }
    })

    console.log(`✅ Retrieved ${settings?.length || 0} trending settings`)

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      raw_settings: settings
    })

  } catch (error) {
    console.error('Error in getTrendingSettings:', error)
    return NextResponse.json({ 
      error: 'Failed to get trending settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const PUT = withAdminAuth(async (request: NextRequest, { user, adminUser }) => {
  try {
    const body = await request.json()
    const { settings, user_id } = body

    console.log('⚙️ Admin Trending Settings PUT called:', { settings, user_id })

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ 
        error: 'Settings object is required' 
      }, { status: 400 })
    }

    const validSettings = [
      'algorithm_enabled',
      'refresh_frequency_hours',
      'top_selling_count',
      'recently_added_count',
      'random_stock_count',
      'min_sales_for_trending',
      'days_for_recent_products',
      'max_total_products',
      'include_manual_products',
      'include_product_flags',
      'pagination_enabled'
    ]

    const updates: Array<{
      setting_key: string
      setting_value: any
      updated_at: string
      updated_by: string
    }> = []
    const errors: string[] = []

    for (const [key, value] of Object.entries(settings)) {
      if (!validSettings.includes(key)) {
        errors.push(`Invalid setting key: ${key}`)
        continue
      }

      // Validate setting values
      if (key === 'algorithm_enabled') {
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`)
          continue
        }
      } else {
        const numValue = parseInt(value as string)
        if (isNaN(numValue) || numValue < 0) {
          errors.push(`${key} must be a positive number`)
          continue
        }
        // Remove hard cap of 10, but add reasonable limits for performance
        if (key.includes('count') && numValue > 200) {
          errors.push(`${key} cannot exceed 200 for performance reasons`)
          continue
        }
        if (key === 'max_total_products' && numValue > 500) {
          errors.push(`max_total_products cannot exceed 500 for performance reasons`)
          continue
        }
      }

      updates.push({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
        updated_by: user_id || adminUser.id
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors',
        details: errors 
      }, { status: 400 })
    }

    if (updates.length === 0) {
      return NextResponse.json({ 
        error: 'No valid settings to update' 
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Update settings one by one
    const results = []
    for (const update of updates) {
      const { data, error } = await supabase
        .from('trending_system_settings')
        .update({
          setting_value: update.setting_value,
          updated_at: update.updated_at,
          updated_by: update.updated_by
        })
        .eq('setting_key', update.setting_key)
        .select()
        .single()

      if (error) {
        console.error(`Error updating setting ${update.setting_key}:`, error)
        errors.push(`Failed to update ${update.setting_key}`)
      } else {
        results.push(data)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Some settings failed to update',
        details: errors,
        updated: results
      }, { status: 500 })
    }

    console.log(`✅ Updated ${results.length} trending settings successfully`)

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updated_settings: results
    })

  } catch (error) {
    console.error('Error in updateTrendingSettings:', error)
    return NextResponse.json({ 
      error: 'Failed to update trending settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})
