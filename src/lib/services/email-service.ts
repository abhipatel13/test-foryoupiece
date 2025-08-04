import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Email service for sending notifications and alerts
 * Currently uses console logging for development, can be extended to use
 * email providers like Resend, SendGrid, or SMTP in production
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface AdminLoginAttemptData {
  timestamp: string
  ipAddress: string
  userAgent: string
  attemptCount: number
  email?: string
}

/**
 * Email service class
 */
export class EmailService {
  private static instance: EmailService
  private supabase: any = null

  private constructor() {}

  private getServiceClient() {
    if (!this.supabase) {
      // Only create service client on server side
      if (typeof window === 'undefined') {
        try {
          this.supabase = createServiceRoleClient()
          if (!this.supabase) {
            console.error('Failed to create service role client in EmailService')
          }
        } catch (error) {
          console.error('Error initializing EmailService:', error)
          this.supabase = null
        }
      } else {
        console.warn('EmailService should only be used on server side')
        return null
      }
    }
    return this.supabase
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  /**
   * Send email notification for failed admin login attempts
   */
  async sendAdminLoginAttemptAlert(data: AdminLoginAttemptData): Promise<boolean> {
    try {
      const emailContent = this.generateAdminLoginAttemptEmail(data)
      
      // For development, log the email content
      console.log('🚨 ADMIN LOGIN ATTEMPT ALERT 🚨')
      console.log('To:', 'akito12350@gmail.com')
      console.log('Subject:', emailContent.subject)
      console.log('Content:', emailContent.html)
      
      // In production, you would send the actual email here
      // Example implementations:
      
      // Option 1: Use Supabase Edge Functions (recommended)
      // const { data: result, error } = await this.supabase.functions.invoke('send-email', {
      //   body: {
      //     to: 'akito12350@gmail.com',
      //     subject: emailContent.subject,
      //     html: emailContent.html
      //   }
      // })
      
      // Option 2: Use a third-party email service
      // const result = await this.sendWithEmailProvider({
      //   to: 'akito12350@gmail.com',
      //   subject: emailContent.subject,
      //   html: emailContent.html
      // })
      
      // For now, we'll simulate successful email sending
      await this.logEmailAttempt({
        to: 'akito12350@gmail.com',
        subject: emailContent.subject,
        type: 'admin_login_alert',
        status: 'sent',
        data: data
      })
      
      return true
      
    } catch (error) {
      console.error('❌ Failed to send admin login attempt alert:', error)
      
      await this.logEmailAttempt({
        to: 'akito12350@gmail.com',
        subject: 'Admin Login Attempt Alert',
        type: 'admin_login_alert',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        data: data
      })
      
      return false
    }
  }

  /**
   * Generate HTML email content for admin login attempt alert
   */
  private generateAdminLoginAttemptEmail(data: AdminLoginAttemptData): { subject: string; html: string; text: string } {
    const subject = `🚨 Foryoupiece Admin: ${data.attemptCount} Failed Login Attempts Detected`
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login Attempt Alert - Foryoupiece</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f9fafb;
            margin: 0;
            padding: 20px;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #dc2626;
            padding: 24px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .alert-title {
            font-size: 18px;
            margin: 0;
        }
        .content {
            padding: 32px 24px;
        }
        .alert-box {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        .alert-icon {
            font-size: 24px;
            margin-bottom: 8px;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .details-table th,
        .details-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        .details-table th {
            background-color: #f9fafb;
            font-weight: 600;
        }
        .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
        }
        .timestamp {
            font-family: monospace;
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">Foryoupiece</div>
            <h1 class="alert-title">🚨 Security Alert</h1>
        </div>
        
        <div class="content">
            <div class="alert-box">
                <div class="alert-icon">⚠️</div>
                <h2 style="margin: 0 0 8px 0; color: #dc2626;">Multiple Failed Admin Login Attempts Detected</h2>
                <p style="margin: 0; color: #7f1d1d;">
                    We've detected <strong>${data.attemptCount} failed login attempts</strong> to the Foryoupiece admin panel from the same source.
                </p>
            </div>
            
            <h3>Attempt Details:</h3>
            <table class="details-table">
                <tr>
                    <th>Timestamp</th>
                    <td><span class="timestamp">${data.timestamp}</span></td>
                </tr>
                <tr>
                    <th>IP Address</th>
                    <td><code>${data.ipAddress}</code></td>
                </tr>
                <tr>
                    <th>User Agent</th>
                    <td style="word-break: break-all; font-size: 12px;">${data.userAgent}</td>
                </tr>
                <tr>
                    <th>Failed Attempts</th>
                    <td><strong style="color: #dc2626;">${data.attemptCount}</strong></td>
                </tr>
                ${data.email ? `
                <tr>
                    <th>Attempted Email</th>
                    <td><code>${data.email}</code></td>
                </tr>
                ` : ''}
            </table>
            
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 20px 0;">
                <h4 style="margin: 0 0 8px 0; color: #1e40af;">🛡️ Security Recommendations:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #1e3a8a;">
                    <li>Review admin access logs for any suspicious activity</li>
                    <li>Consider implementing IP-based restrictions if needed</li>
                    <li>Verify that all admin accounts use strong, unique passwords</li>
                    <li>Monitor for any successful unauthorized access attempts</li>
                </ul>
            </div>
            
            <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
                This is an automated security alert from the Foryoupiece admin system. 
                If you have any concerns about these login attempts, please investigate immediately.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Foryoupiece Admin Security System</strong></p>
            <p>This alert was generated automatically at ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>
    `
    
    const text = `
🚨 FORYOUPIECE ADMIN SECURITY ALERT 🚨

Multiple failed admin login attempts detected:

Timestamp: ${data.timestamp}
IP Address: ${data.ipAddress}
Failed Attempts: ${data.attemptCount}
User Agent: ${data.userAgent}
${data.email ? `Attempted Email: ${data.email}` : ''}

Please review admin access logs and take appropriate security measures if necessary.

This is an automated alert from the Foryoupiece admin security system.
    `
    
    return { subject, html, text }
  }

  /**
   * Log email attempts to database for monitoring
   */
  private async logEmailAttempt(logData: {
    to: string
    subject: string
    type: string
    status: 'sent' | 'failed'
    error?: string
    data?: any
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_logs')
        .insert({
          recipient: logData.to,
          subject: logData.subject,
          email_type: logData.type,
          status: logData.status,
          error_message: logData.error,
          metadata: logData.data,
          created_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('❌ Failed to log email attempt:', error)
      }
    } catch (error) {
      // Don't throw here to avoid breaking the main email flow
      console.error('❌ Failed to log email attempt:', error)
    }
  }

  /**
   * Test email functionality (for development)
   * ⚠️ SECURITY: This method uses hardcoded test data for development only
   */
  async testEmail(): Promise<boolean> {
    // ⚠️ SECURITY: Using hardcoded test data - only for development
    const testData: AdminLoginAttemptData = {
      timestamp: new Date().toISOString(),
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      attemptCount: 3,
      email: 'test@example.com' // Safe test email
    }
    
    return await this.sendAdminLoginAttemptAlert(testData)
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance()
