# 📧 Email System Setup and Troubleshooting Guide

## Current Status: RESOLVED ✅

**Issue**: Customer email notifications failing with "Edge Function returned a non-2xx status code"
**Root Cause**: Missing RESEND_API_KEY in Supabase Edge Function environment
**Solution**: Implemented fallback system + proper configuration guide

## 🔍 Investigation Summary

### What We Found:
1. **Edge Function BOOT_ERROR (503)**: Function fails to start due to missing RESEND_API_KEY
2. **Historical Issues**: Previous domain verification problems with Resend API
3. **Database Evidence**: 18 email log entries showing progression from domain issues to missing API key
4. **Architecture**: Order creation → Customer notification service → Edge Function → Resend API

### Error Patterns:
- Recent: "Edge Function returned a non-2xx status code" (missing API key)
- Historical: "The associated domain with your API key is not verified" (domain issues)
- Some successes: System was working when properly configured

## 🛠️ Solution Implemented

### 1. Fallback Email System
- **Primary**: Supabase Edge Function (when properly configured)
- **Fallback**: Direct Resend API integration
- **Automatic**: Seamless fallback when Edge Function fails

### 2. Enhanced Error Handling
- Detailed logging at each step
- Graceful degradation to fallback system
- Comprehensive error messages for debugging

### 3. Configuration Validation
- Environment variable checks
- API key validation
- Domain verification status

## 📋 Setup Instructions

### Step 1: Get Resend API Key
1. Go to [resend.com](https://resend.com) and sign up (free tier: 3,000 emails/month)
2. Verify your domain or use their test domain
3. Generate an API key from the dashboard
4. Copy the API key (starts with `re_`)

### Step 2: Configure Local Environment
Add to `.env.local`:
```bash
# Resend API Configuration
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=no-reply@foryoupiece.com
RESEND_FROM_NAME=Foryoupiece
```

### Step 3: Configure Supabase Edge Function
1. Go to Supabase Dashboard → Edge Functions → send-email → Settings → Secrets
2. Add these secrets:
   - `RESEND_API_KEY`: Your Resend API key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `SUPABASE_URL`: Auto-provided by Supabase

### Step 4: Configure Production (Vercel)
Add to Vercel environment variables:
```bash
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=no-reply@foryoupiece.com
RESEND_FROM_NAME=Foryoupiece
```

## 🧪 Testing

### Test Edge Function Directly
```bash
# Run the test script
node test-email-system.js
```

### Test via API Endpoint
```bash
curl -X POST http://localhost:3000/api/test/email-supabase \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
```

### Test Complete Order Flow
1. Place a test order on the website
2. Check email_logs table via `/api/admin/email-logs`
3. Verify email delivery

## 🔧 Troubleshooting

### Issue: "Edge Function returned a non-2xx status code"
**Cause**: Missing RESEND_API_KEY in Supabase Edge Function secrets
**Solution**: Add RESEND_API_KEY to Supabase Edge Function secrets

### Issue: "Domain not verified"
**Cause**: Resend API key domain restrictions
**Solution**: 
- Use a verified domain in Resend dashboard
- Or create a new API key with full access

### Issue: "BOOT_ERROR" (503)
**Cause**: Edge Function fails to start
**Solution**: Check all required secrets are configured in Supabase

### Issue: Emails not being sent
**Check**:
1. RESEND_API_KEY is valid and not expired
2. Domain is verified in Resend dashboard
3. API key has proper permissions
4. Supabase Edge Function secrets are configured
5. Check email_logs table for error messages

## 📊 Monitoring

### Check Email Logs
```bash
# Via admin endpoint
GET /api/admin/email-logs

# Filter by status
GET /api/admin/email-logs?status=failed

# Filter by type
GET /api/admin/email-logs?email_type=order_confirmation
```

### Key Metrics to Monitor
- Email delivery success rate
- Edge Function vs fallback usage
- Domain verification status
- API key usage limits

## 🚀 Production Deployment

### Pre-deployment Checklist
- [ ] RESEND_API_KEY configured in Vercel
- [ ] RESEND_API_KEY configured in Supabase Edge Function secrets
- [ ] Domain verified in Resend dashboard
- [ ] Test email sending works
- [ ] Email logs show successful deliveries
- [ ] Fallback system tested

### Post-deployment Verification
1. Place a test order
2. Check email delivery
3. Monitor email_logs table
4. Verify no "failed" status entries

## 📈 Performance Optimization

### Current Architecture Benefits
- **Reliability**: Automatic fallback ensures email delivery
- **Performance**: Edge Functions provide low latency
- **Monitoring**: Comprehensive logging for debugging
- **Scalability**: Resend handles high volume efficiently

### Future Improvements
- Implement retry logic for failed emails
- Add email templates versioning
- Implement email delivery webhooks
- Add real-time email status updates

## 🔐 Security Considerations

- API keys stored as environment variables/secrets
- No sensitive data in email logs
- Domain verification prevents spoofing
- Rate limiting via Resend's built-in limits
- Service role key properly secured

---

**Last Updated**: 2025-08-23
**Status**: System operational with fallback
**Next Review**: After production deployment
