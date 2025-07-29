import { NextRequest, NextResponse } from 'next/server'

/**
 * Admin Configuration API
 * Provides server-side admin configuration data to client components
 * 
 * Security: Only provides non-sensitive configuration data
 * The admin email is safe to expose as it's just an identifier, not credentials
 */
export async function GET(request: NextRequest) {
  try {
    // Get admin email from server-side environment variable
    const adminEmail = process.env.ADMIN_EMAIL

    if (!adminEmail) {
      console.error('❌ ADMIN_EMAIL environment variable not configured')
      return NextResponse.json({
        success: false,
        error: 'Admin configuration not available'
      }, { status: 500 })
    }

    // Return admin configuration data
    return NextResponse.json({
      success: true,
      data: {
        adminEmail: adminEmail,
        // Add other non-sensitive admin config here if needed
        environment: process.env.NODE_ENV || 'development'
      }
    })

  } catch (error) {
    console.error('❌ Error fetching admin configuration:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch admin configuration'
    }, { status: 500 })
  }
}

/**
 * Security Notes:
 * - This endpoint only exposes the admin email, which is safe as it's just an identifier
 * - Actual admin authentication still requires password verification
 * - No sensitive credentials or tokens are exposed
 * - Rate limiting is handled by the global middleware
 */
