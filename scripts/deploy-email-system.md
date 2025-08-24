# Email System Deployment Guide

This guide walks through deploying the new robust email system with transactional outbox pattern and durable queues.

## 🚀 Deployment Steps

### 1. Database Migration

Run the database migration to create the email queue infrastructure:

```bash
# Apply the migration
supabase db push

# Or if using migration files
supabase migration up
```

This will:
- Enable the `pgmq` extension for durable queues
- Create the `email_outbox` table for transactional outbox pattern
- Enhance the `email_logs` table with delivery tracking
- Create the `emails` queue using pgmq
- Add helper functions for queue management

### 2. Deploy Edge Functions

Deploy the new Edge Functions:

```bash
# Deploy the email worker
supabase functions deploy email-worker

# Deploy the email scheduler
supabase functions deploy email-scheduler

# Redeploy the updated send-email function
supabase functions deploy send-email
```

### 3. Set Up Cron Jobs (Optional)

Set up a cron job to automatically process the email queue:

```bash
# Add to your cron scheduler (every 2 minutes)
*/2 * * * * curl -X POST https://your-project.supabase.co/functions/v1/email-scheduler \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Or use Supabase's built-in cron functionality if available.

### 4. Configure Resend Webhook

1. Go to your Resend dashboard
2. Navigate to Webhooks
3. Add a new webhook endpoint: `https://your-domain.com/api/webhooks/resend`
4. Select the events you want to track:
   - `email.sent`
   - `email.delivered`
   - `email.bounced`
   - `email.complained`
   - `email.opened` (optional)
   - `email.clicked` (optional)

### 5. Environment Variables

Ensure these environment variables are set:

```env
# Required
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-api-key

# Optional
RESEND_WEBHOOK_SECRET=your-webhook-secret
ADMIN_API_KEY=your-admin-api-key
```

## 🧪 Testing the System

### Test 1: Queue System Test

```bash
curl -X POST https://your-domain.com/api/test/email-queue \
  -H "Content-Type: application/json" \
  -d '{
    "email_type": "order_confirmation",
    "customer_email": "test@example.com",
    "trigger_worker": true
  }'
```

### Test 2: Manual Worker Trigger

```bash
curl -X POST https://your-domain.com/api/admin/email-worker \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### Test 3: Queue Status Check

```bash
curl -X GET https://your-domain.com/api/admin/email-worker
```

## 📊 Monitoring

### Check Queue Status

```sql
-- Check pending emails
SELECT * FROM get_pending_emails(10);

-- Check outbox status
SELECT status, COUNT(*) 
FROM email_outbox 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Check recent email logs
SELECT * FROM email_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Monitor Queue Health

```sql
-- Check for stuck emails (processing for too long)
SELECT * FROM email_outbox 
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- Check failure rates
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*), 2) as failure_rate
FROM email_outbox 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## 🔧 Troubleshooting

### Common Issues

1. **Emails not being processed**
   - Check if the email worker is running
   - Verify queue has messages: `SELECT * FROM get_pending_emails(5);`
   - Check worker logs in Supabase Functions dashboard

2. **High failure rates**
   - Check Resend API limits and quotas
   - Verify RESEND_API_KEY is correct
   - Check for rate limiting (429 errors)

3. **Webhook not updating delivery status**
   - Verify webhook URL is accessible
   - Check webhook signature validation
   - Ensure Resend webhook is configured correctly

### Recovery Commands

```sql
-- Reset stuck processing emails
UPDATE email_outbox 
SET status = 'pending', attempts = 0, next_retry_at = NULL
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- Retry failed emails (reset attempts)
UPDATE email_outbox 
SET status = 'pending', attempts = 0, next_retry_at = NULL, error_message = NULL
WHERE status = 'failed' 
  AND attempts < max_attempts;

-- Clear old completed emails (optional cleanup)
DELETE FROM email_outbox 
WHERE status = 'sent' 
  AND processed_at < NOW() - INTERVAL '7 days';
```

## 🎯 Performance Tuning

### Queue Processing Rate

The system is configured to respect Resend's rate limits (~2 req/s). Adjust the worker processing rate if needed:

```typescript
// In email-worker/index.ts
const RATE_LIMIT_DELAY = 500; // milliseconds between requests
const MAX_BATCH_SIZE = 10;    // emails per batch
```

### Retry Configuration

Adjust retry settings in the database:

```sql
-- Update max attempts for specific email types
UPDATE email_outbox 
SET max_attempts = 5 
WHERE email_type = 'order_confirmation';

-- Adjust retry delays (in mark_email_failed function)
-- Current: 5min, 10min, 20min (exponential backoff)
```

## 📈 Benefits of New System

1. **Durability**: Emails survive server restarts and failures
2. **Reliability**: Transactional outbox ensures no lost emails
3. **Observability**: Complete audit trail and delivery tracking
4. **Rate Limiting**: Respects Resend API limits automatically
5. **Retries**: Automatic retry with exponential backoff
6. **Monitoring**: Real-time queue status and health metrics
7. **Scalability**: Can handle high email volumes efficiently

## 🔄 Migration from Old System

The new system is backward compatible. The old `customerNotificationService.sendOrderConfirmation()` calls have been replaced with queue enqueuing in the order creation route.

Old orders will continue to work, but new orders will use the robust queue system.
