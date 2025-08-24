import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Resend Webhook Handler
 * Receives delivery status updates from Resend for accurate email tracking
 * 
 * Webhook events:
 * - email.sent: Email was accepted by Resend
 * - email.delivered: Email was delivered to recipient
 * - email.bounced: Email bounced
 * - email.complained: Recipient marked as spam
 * - email.opened: Recipient opened the email
 * - email.clicked: Recipient clicked a link in the email
 */

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: {
    id: string
    to: string[]
    from: string
    subject: string
    created_at: string
    email_id?: string
    bounce?: {
      type: string
      reason: string
    }
    complaint?: {
      type: string
      reason: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Resend webhook received')

    // Verify webhook signature (optional but recommended)
    const signature = request.headers.get('resend-signature')
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      // TODO: Implement signature verification
      // const isValid = verifyWebhookSignature(body, signature, webhookSecret)
      // if (!isValid) {
      //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      // }
    }

    const body: ResendWebhookEvent = await request.json()
    console.log('📨 Webhook event:', { type: body.type, email_id: body.data.id })

    const supabase = createServiceRoleClient()

    // Process the webhook event
    await processWebhookEvent(supabase, body)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('❌ Resend webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}

async function processWebhookEvent(supabase: any, event: ResendWebhookEvent) {
  const { type, data } = event
  const emailId = data.id

  // Map Resend event types to our delivery statuses
  const statusMapping: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.opened': 'opened',
    'email.clicked': 'clicked'
  }

  const deliveryStatus = statusMapping[type]
  if (!deliveryStatus) {
    console.log(`⚠️ Unknown webhook event type: ${type}`)
    return
  }

  // Find the email log entry by provider_id
  const { data: emailLog, error: findError } = await supabase
    .from('email_logs')
    .select('*')
    .eq('provider_id', emailId)
    .single()

  if (findError || !emailLog) {
    console.warn(`⚠️ Email log not found for provider_id: ${emailId}`)
    return
  }

  // Prepare update data
  const updateData: any = {
    delivery_status: deliveryStatus,
    delivery_timestamp: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Add bounce/complaint specific data
  if (type === 'email.bounced' && data.bounce) {
    updateData.bounce_reason = `${data.bounce.type}: ${data.bounce.reason}`
  } else if (type === 'email.complained' && data.complaint) {
    updateData.bounce_reason = `Complaint: ${data.complaint.reason}`
  }

  // Update the email log
  const { error: updateError } = await supabase
    .from('email_logs')
    .update(updateData)
    .eq('id', emailLog.id)

  if (updateError) {
    console.error('❌ Failed to update email log:', updateError)
    throw updateError
  }

  console.log(`✅ Updated email log ${emailLog.id} with status: ${deliveryStatus}`)

  // If this is a bounce or complaint, we might want to take additional action
  if (deliveryStatus === 'bounced' || deliveryStatus === 'complained') {
    await handleEmailFailure(supabase, emailLog, updateData.bounce_reason)
  }
}

async function handleEmailFailure(supabase: any, emailLog: any, reason: string) {
  console.log(`🚨 Email failure detected: ${emailLog.email_type} for ${emailLog.recipient}`)
  console.log(`🚨 Reason: ${reason}`)

  // If this email has an associated outbox entry, mark it as failed
  if (emailLog.outbox_id) {
    const { error: outboxError } = await supabase.rpc('mark_email_failed', {
      p_outbox_id: emailLog.outbox_id,
      p_error_message: `Delivery failed: ${reason}`
    })

    if (outboxError) {
      console.error('❌ Failed to update outbox entry:', outboxError)
    } else {
      console.log('✅ Marked outbox entry as failed')
    }
  }

  // TODO: Add additional failure handling logic here
  // - Add recipient to suppression list for hard bounces
  // - Send alert to admin for high bounce rates
  // - Retry with alternative email address if available
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Resend webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
