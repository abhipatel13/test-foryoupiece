import { createServiceRoleClient } from '@/lib/supabase/service-role'
import crypto from 'crypto'

export interface Admin2FASession {
  id: string
  userId: string
  adminUserId: string
  sessionToken: string
  ipAddress: string
  userAgent?: string
  isTrustedIp: boolean
  requires2fa: boolean
  is2faVerified: boolean
  expiresAt: string
}

export interface Admin2FAToken {
  id: string
  userId: string
  tokenCode: string
  tokenType: 'email' | 'sms' | 'totp'
  expiresAt: string
  sessionId: string
  sentTo: string
}

export interface SecurityLogEvent {
  userId: string
  eventType: string
  eventDescription: string
  ipAddress?: string
  userAgent?: string
  severity?: 'low' | 'info' | 'warning' | 'high' | 'critical'
  metadata?: Record<string, any>
}

export class Admin2FAService {
  private supabase = createServiceRoleClient()

  /**
   * Check if an IP address is trusted for a user
   * DISABLED: Always return false to disable IP-based restrictions
   */
  async isTrustedIP(userId: string, ipAddress: string): Promise<boolean> {
    // IP-based restrictions are disabled for development/production compatibility
    console.log('🔄 IP Trust Check: Disabled (always returns false)')
    return false
  }

  /**
   * Create a new admin login session
   */
  async createAdminSession(
    userId: string,
    adminUserId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<Admin2FASession | null> {
    try {
      const sessionToken = crypto.randomBytes(32).toString('hex')
      const isTrustedIp = false // Always false - IP restrictions disabled
      const requires2fa = true // Always require 2FA for admin access
      
      // Session expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      const { data, error } = await this.supabase
        .from('admin_login_sessions')
        .insert({
          user_id: userId,
          admin_user_id: adminUserId,
          session_token: sessionToken,
          ip_address: ipAddress,
          user_agent: userAgent,
          is_trusted_ip: isTrustedIp,
          requires_2fa: requires2fa,
          is_2fa_verified: !requires2fa, // If no 2FA required, mark as verified
          expires_at: expiresAt
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating admin session:', error)
        return null
      }

      // Log the session creation
      await this.logSecurityEvent({
        userId,
        eventType: 'login_attempt',
        eventDescription: `Admin session created for IP ${ipAddress}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: { sessionId: data.id, requires2fa, isTrustedIp }
      })

      return {
        id: data.id,
        userId: data.user_id,
        adminUserId: data.admin_user_id,
        sessionToken: data.session_token,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        isTrustedIp: data.is_trusted_ip,
        requires2fa: data.requires_2fa,
        is2faVerified: data.is_2fa_verified,
        expiresAt: data.expires_at
      }
    } catch (error) {
      console.error('Exception creating admin session:', error)
      return null
    }
  }

  /**
   * Generate and send 2FA token
   */
  async generate2FAToken(
    sessionId: string,
    userId: string,
    adminUserId: string,
    email: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ success: boolean; tokenId?: string; error?: string }> {
    try {
      // Generate 6-digit code
      const tokenCode = Math.floor(100000 + Math.random() * 900000).toString()
      const tokenHash = crypto.createHash('sha256').update(tokenCode).digest('hex')
      
      // Token expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      // Store the token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('admin_2fa_tokens')
        .insert({
          user_id: userId,
          admin_user_id: adminUserId,
          token_code: tokenCode, // Store plain code for email sending
          token_hash: tokenHash,
          token_type: 'email',
          expires_at: expiresAt,
          session_id: sessionId,
          sent_to: email,
          ip_address: ipAddress,
          user_agent: userAgent
        })
        .select()
        .single()

      if (tokenError) {
        console.error('Error storing 2FA token:', tokenError)
        return { success: false, error: 'Failed to generate 2FA token' }
      }

      // Send email with 2FA code
      const emailSent = await this.send2FAEmail(email, tokenCode)
      
      if (!emailSent) {
        // Clean up the token if email failed
        await this.supabase
          .from('admin_2fa_tokens')
          .delete()
          .eq('id', tokenData.id)
        
        return { success: false, error: 'Failed to send 2FA email' }
      }

      // Log the 2FA token generation
      await this.logSecurityEvent({
        userId,
        eventType: '2fa_sent',
        eventDescription: `2FA token sent to ${email}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: { sessionId, tokenId: tokenData.id }
      })

      return { success: true, tokenId: tokenData.id }
    } catch (error) {
      console.error('Exception generating 2FA token:', error)
      return { success: false, error: 'Internal error generating 2FA token' }
    }
  }

  /**
   * Verify 2FA token
   */
  async verify2FAToken(
    sessionId: string,
    tokenCode: string,
    ipAddress: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('admin_2fa_tokens')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (tokenError || !tokenData) {
        await this.logSecurityEvent({
          userId: '', // We don't have userId here
          eventType: '2fa_failed',
          eventDescription: 'Invalid or expired 2FA token',
          ipAddress,
          severity: 'warning',
          metadata: { sessionId, reason: 'token_not_found' }
        })
        return { success: false, error: 'Invalid or expired 2FA token' }
      }

      // Check attempt count
      if (tokenData.attempts_count >= tokenData.max_attempts) {
        await this.logSecurityEvent({
          userId: tokenData.user_id,
          eventType: '2fa_failed',
          eventDescription: 'Too many 2FA attempts',
          ipAddress,
          severity: 'high',
          metadata: { sessionId, tokenId: tokenData.id }
        })
        return { success: false, error: 'Too many attempts. Please request a new code.' }
      }

      // Increment attempt count
      await this.supabase
        .from('admin_2fa_tokens')
        .update({ 
          attempts_count: tokenData.attempts_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenData.id)

      // Verify the token
      if (tokenData.token_code !== tokenCode) {
        await this.logSecurityEvent({
          userId: tokenData.user_id,
          eventType: '2fa_failed',
          eventDescription: 'Incorrect 2FA token',
          ipAddress,
          severity: 'warning',
          metadata: { sessionId, tokenId: tokenData.id }
        })
        return { success: false, error: 'Incorrect verification code' }
      }

      // Mark token as verified
      await this.supabase
        .from('admin_2fa_tokens')
        .update({ 
          is_verified: true,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenData.id)

      // Mark session as 2FA verified
      await this.supabase
        .from('admin_login_sessions')
        .update({ 
          is_2fa_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      // Add IP to trusted list if verification successful
      await this.addTrustedIP(tokenData.user_id, tokenData.admin_user_id, ipAddress)

      // Log successful 2FA verification
      await this.logSecurityEvent({
        userId: tokenData.user_id,
        eventType: '2fa_verified',
        eventDescription: '2FA verification successful',
        ipAddress,
        severity: 'info',
        metadata: { sessionId, tokenId: tokenData.id }
      })

      return { success: true }
    } catch (error) {
      console.error('Exception verifying 2FA token:', error)
      return { success: false, error: 'Internal error verifying token' }
    }
  }

  /**
   * Add IP to trusted list
   */
  private async addTrustedIP(
    userId: string,
    adminUserId: string,
    ipAddress: string
  ): Promise<void> {
    try {
      // Check if IP is already trusted
      const { data: existing } = await this.supabase
        .from('admin_trusted_ips')
        .select('id')
        .eq('user_id', userId)
        .eq('ip_address', ipAddress)
        .single()

      if (existing) {
        // Update existing record
        await this.supabase
          .from('admin_trusted_ips')
          .update({
            is_active: true,
            last_used_at: new Date().toISOString(),
            usage_count: 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        // Create new trusted IP record
        await this.supabase
          .from('admin_trusted_ips')
          .insert({
            user_id: userId,
            admin_user_id: adminUserId,
            ip_address: ipAddress,
            description: 'Auto-added after successful 2FA verification',
            auto_added: true,
            trust_level: 'standard',
            last_used_at: new Date().toISOString(),
            usage_count: 1
          })
      }
    } catch (error) {
      console.error('Error adding trusted IP:', error)
    }
  }

  /**
   * Send 2FA email
   */
  private async send2FAEmail(email: string, code: string): Promise<boolean> {
    try {
      // Use Supabase's built-in email functionality or your email service
      // For now, we'll use a simple approach - in production, use a proper email service
      
      // This is a placeholder - implement actual email sending
      console.log(`📧 2FA Code for ${email}: ${code}`)
      
      // In production, integrate with your email service (Resend, SendGrid, etc.)
      // const emailResult = await sendEmail({
      //   to: email,
      //   subject: 'Foryoupiece Admin - Two-Factor Authentication Code',
      //   html: `Your verification code is: <strong>${code}</strong>`
      // })
      
      return true // Return actual result from email service
    } catch (error) {
      console.error('Error sending 2FA email:', error)
      return false
    }
  }

  /**
   * Log security events
   */
  async logSecurityEvent(event: SecurityLogEvent): Promise<void> {
    try {
      await this.supabase
        .rpc('log_admin_security_event', {
          p_user_id: event.userId,
          p_event_type: event.eventType,
          p_event_description: event.eventDescription,
          p_ip_address: event.ipAddress,
          p_user_agent: event.userAgent,
          p_severity: event.severity || 'info',
          p_metadata: event.metadata || {}
        })
    } catch (error) {
      console.error('Error logging security event:', error)
    }
  }

  /**
   * Determine if 2FA should be required based on various factors
   */
  private shouldRequire2FA(ipAddress: string, userAgent?: string): boolean {
    // Always require 2FA for admin logins for maximum security
    // In the future, you could add more sophisticated logic here
    return true
  }

  /**
   * Get admin session by token
   */
  async getAdminSession(sessionToken: string): Promise<Admin2FASession | null> {
    try {
      const { data, error } = await this.supabase
        .from('admin_login_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        return null
      }

      return {
        id: data.id,
        userId: data.user_id,
        adminUserId: data.admin_user_id,
        sessionToken: data.session_token,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        isTrustedIp: data.is_trusted_ip,
        requires2fa: data.requires_2fa,
        is2faVerified: data.is_2fa_verified,
        expiresAt: data.expires_at
      }
    } catch (error) {
      console.error('Exception getting admin session:', error)
      return null
    }
  }

  /**
   * Clean up expired tokens and sessions
   */
  async cleanupExpired(): Promise<void> {
    try {
      await this.supabase.rpc('cleanup_expired_admin_security')
    } catch (error) {
      console.error('Error cleaning up expired security data:', error)
    }
  }
}
