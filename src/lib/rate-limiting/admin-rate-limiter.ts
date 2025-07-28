import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/services/email-service'

/**
 * Rate limiting result interface
 */
export interface RateLimitResult {
  allowed: boolean
  attempts: number
  resetTime: number
  remaining: number
  identifier: string
  type: string
}

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  requests: number
  windowMs: number
}

/**
 * Rate limit store entry interface
 */
interface RateLimitEntry {
  count: number
  resetTime: number
}

/**
 * Admin rate limiting configuration
 * These limits are designed to be reasonable for normal admin usage
 * while protecting against abuse and brute force attacks
 */
export const ADMIN_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Admin login attempts - strict to prevent brute force
  admin_login: { 
    requests: 5, 
    windowMs: 15 * 60 * 1000 // 5 attempts per 15 minutes
  },
  
  // Admin dashboard access - generous for normal usage
  admin_access: { 
    requests: 100, 
    windowMs: 15 * 60 * 1000 // 100 requests per 15 minutes
  },
  
  // Admin API endpoints - balanced for admin operations
  admin_api: { 
    requests: 200, 
    windowMs: 60 * 1000 // 200 requests per minute
  },
  
  // BoxHero sync operations - limited due to external API constraints
  admin_boxhero_sync: { 
    requests: 10, 
    windowMs: 60 * 1000 // 10 sync operations per minute
  },
  
  // Bulk operations (user management, product updates, etc.)
  admin_bulk_operations: { 
    requests: 50, 
    windowMs: 5 * 60 * 1000 // 50 operations per 5 minutes
  }
}

/**
 * In-memory rate limiting store
 * In production, consider using Redis for distributed rate limiting
 */
class AdminRateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Start cleanup process
    this.startCleanup()
  }

  /**
   * Get rate limit entry for a key
   */
  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key)
  }

  /**
   * Set rate limit entry for a key
   */
  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  /**
   * Delete rate limit entry for a key
   */
  delete(key: string): boolean {
    return this.store.delete(key)
  }

  /**
   * Get store size for monitoring
   */
  size(): number {
    return this.store.size
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Rate limiter cleanup: removed ${cleanedCount} expired entries`)
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * Stop cleanup process (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton rate limit store
const rateLimitStore = new AdminRateLimitStore()

/**
 * Check rate limit for a given identifier and type
 */
export async function checkAdminRateLimit(
  identifier: string,
  type: keyof typeof ADMIN_RATE_LIMITS
): Promise<RateLimitResult> {
  const limit = ADMIN_RATE_LIMITS[type]
  
  if (!limit) {
    throw new Error(`Unknown rate limit type: ${type}`)
  }

  const key = `admin_${type}:${identifier}`
  const now = Date.now()
  
  const existing = rateLimitStore.get(key)
  
  if (!existing || now > existing.resetTime) {
    // Reset or create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + limit.windowMs
    }
    
    rateLimitStore.set(key, newEntry)
    
    return {
      allowed: true,
      attempts: 1,
      resetTime: newEntry.resetTime,
      remaining: limit.requests - 1,
      identifier,
      type
    }
  }
  
  if (existing.count >= limit.requests) {
    // Rate limit exceeded
    return {
      allowed: false,
      attempts: existing.count,
      resetTime: existing.resetTime,
      remaining: 0,
      identifier,
      type
    }
  }
  
  // Increment counter
  existing.count++
  rateLimitStore.set(key, existing)
  
  return {
    allowed: true,
    attempts: existing.count,
    resetTime: existing.resetTime,
    remaining: limit.requests - existing.count,
    identifier,
    type
  }
}

/**
 * Create rate limit headers for HTTP responses
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const limit = ADMIN_RATE_LIMITS[result.type as keyof typeof ADMIN_RATE_LIMITS]
  
  return {
    'X-RateLimit-Limit': limit.requests.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    'X-RateLimit-Type': result.type,
    'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
  }
}

/**
 * Create rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const headers = createRateLimitHeaders(result)
  const resetTimeSeconds = Math.ceil((result.resetTime - Date.now()) / 1000)
  
  return NextResponse.json({
    success: false,
    error: 'Rate limit exceeded',
    message: `Too many requests. Please try again in ${resetTimeSeconds} seconds.`,
    rateLimitInfo: {
      type: result.type,
      limit: ADMIN_RATE_LIMITS[result.type as keyof typeof ADMIN_RATE_LIMITS].requests,
      remaining: result.remaining,
      resetTime: new Date(result.resetTime).toISOString(),
      retryAfter: resetTimeSeconds
    }
  }, { 
    status: 429,
    headers
  })
}

/**
 * Get client identifier from request
 * Uses IP address and User-Agent for identification
 */
export function getClientIdentifier(request: NextRequest): string {
  // Get IP address from various headers (for different proxy setups)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown'
  
  // Get user agent for additional identification
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // Create a simple hash of IP + User-Agent for identification
  const identifier = `${ip}:${userAgent.substring(0, 50)}`
  
  return identifier
}

/**
 * Get user-specific identifier from request (when user is authenticated)
 */
export function getUserIdentifier(userId: string, request: NextRequest): string {
  // For authenticated users, use user ID as primary identifier
  // Still include IP for additional security
  const ip = getClientIdentifier(request).split(':')[0]
  return `user:${userId}:${ip}`
}

/**
 * Get rate limiter statistics (for monitoring)
 */
export function getRateLimiterStats() {
  return {
    storeSize: rateLimitStore.size(),
    timestamp: new Date().toISOString(),
    limits: ADMIN_RATE_LIMITS
  }
}

/**
 * Reset rate limit for a specific identifier and type (for testing/admin override)
 */
export function resetRateLimit(identifier: string, type: keyof typeof ADMIN_RATE_LIMITS): boolean {
  const key = `admin_${type}:${identifier}`
  return rateLimitStore.delete(key)
}

/**
 * Check if email notification should be sent for failed login attempts
 * Sends email when there are more than 2 failed attempts and no email has been sent in this window
 */
export async function checkAndSendLoginAttemptAlert(
  identifier: string,
  request: NextRequest,
  attemptedEmail?: string
): Promise<void> {
  try {
    const key = `admin_admin_login:${identifier}`
    const entry = rateLimitStore.get(key)

    if (!entry || entry.count <= 2) {
      // Not enough failed attempts to trigger alert
      return
    }

    // Check if we've already sent an email for this rate limit window
    const emailKey = `email_sent_admin_login:${identifier}`
    const emailSent = rateLimitStore.get(emailKey)

    if (emailSent) {
      // Email already sent for this window
      return
    }

    // Mark that we're sending an email for this window
    rateLimitStore.set(emailKey, {
      count: 1,
      resetTime: entry.resetTime // Use same reset time as the rate limit
    })

    // Get client information
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Send email notification
    console.log(`📧 Sending admin login attempt alert: ${entry.count} failed attempts from ${ip}`)

    await emailService.sendAdminLoginAttemptAlert({
      timestamp: new Date().toISOString(),
      ipAddress: ip,
      userAgent: userAgent,
      attemptCount: entry.count,
      email: attemptedEmail
    })

    console.log('✅ Admin login attempt alert sent successfully')

  } catch (error) {
    console.error('❌ Failed to send admin login attempt alert:', error)
    // Don't throw error to avoid breaking the main login flow
  }
}
