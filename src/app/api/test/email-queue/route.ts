import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Test endpoint for the new email queue system
 * This allows testing the transactional outbox pattern without creating real orders
 */

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing email queue system...')

    const supabase = createServiceRoleClient()
    const body = await request.json()

    const {
      test_order_id = 'test-' + Date.now(),
      email_type = 'order_confirmation',
      customer_email = 'akito12350@gmail.com'
    } = body

    console.log(`📧 Enqueuing test email: ${email_type} for ${customer_email}`)

    // Create a test order entry (minimal data for testing)
    const testOrder = {
      id: test_order_id,
      order_number: `TEST-${Date.now()}`,
      email: customer_email,
      total_amount: 10.50,
      subtotal: 9.00,
      shipping_cost: 1.50,
      discount_amount: 0,
      coupon_discount_amount: 0,
      points_used: 0,
      status: 'on_hold',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insert test order
    const { error: orderError } = await supabase
      .from('orders')
      .upsert(testOrder)

    if (orderError) {
      throw new Error(`Failed to create test order: ${orderError.message}`)
    }

    // Create test order items
    const testItems = [
      {
        order_id: test_order_id,
        title: 'Test Product 1',
        quantity: 1,
        price: 9.00,
        total: 9.00
      }
    ]

    const { error: itemsError } = await supabase
      .from('order_items')
      .upsert(testItems)

    if (itemsError) {
      console.warn('⚠️ Failed to create test order items:', itemsError.message)
    }

    // Create test user profile
    const testUser = {
      id: 'test-user-' + Date.now(),
      first_name: 'Test',
      last_name: 'User',
      email: customer_email
    }

    const { error: userError } = await supabase
      .from('users')
      .upsert(testUser)

    if (userError) {
      console.warn('⚠️ Failed to create test user:', userError.message)
    }

    // Update order with user_id
    await supabase
      .from('orders')
      .update({ user_id: testUser.id })
      .eq('id', test_order_id)

    // Enqueue the email using the transactional outbox pattern
    const { data: outboxId, error: enqueueError } = await supabase.rpc('enqueue_email_message', {
      p_order_id: test_order_id,
      p_email_type: email_type,
      p_payload: {
        order_number: testOrder.order_number,
        customer_email: customer_email,
        test: true,
        enqueued_at: new Date().toISOString()
      }
    })

    if (enqueueError) {
      throw new Error(`Failed to enqueue email: ${enqueueError.message}`)
    }

    console.log(`✅ Test email enqueued successfully with outbox ID: ${outboxId}`)

    // Optionally trigger the worker immediately for testing
    const triggerWorker = body.trigger_worker !== false

    let workerResult = null
    if (triggerWorker) {
      console.log('🚀 Triggering email worker for immediate processing...')
      
      const { data: workerData, error: workerError } = await supabase.functions.invoke('email-worker', {
        body: { trigger: 'test' }
      })

      if (workerError) {
        console.error('❌ Worker trigger failed:', workerError)
        workerResult = { error: workerError.message }
      } else {
        workerResult = workerData
        console.log('✅ Worker completed:', workerResult)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test email enqueued successfully',
      test_data: {
        order_id: test_order_id,
        order_number: testOrder.order_number,
        email_type,
        customer_email,
        outbox_id: outboxId
      },
      worker_triggered: triggerWorker,
      worker_result: workerResult,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Email queue test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Email queue test failed',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Email queue test endpoint is active',
    usage: {
      method: 'POST',
      body: {
        test_order_id: 'optional-test-order-id',
        email_type: 'order_confirmation | order_shipped | order_cancelled',
        customer_email: 'test@example.com',
        trigger_worker: 'true | false (default: true)'
      }
    },
    timestamp: new Date().toISOString()
  })
}
