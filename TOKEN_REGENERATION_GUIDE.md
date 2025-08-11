# 🔑 Token Regeneration Quick Guide
## Foryoupiece E-commerce Security Update

**URGENT**: These tokens must be regenerated before production deployment

---

## 🚨 **CRITICAL TOKENS TO REGENERATE**

### **1. Telegram Bot Token**
```bash
# Current (COMPROMISED)
TELEGRAM_BOT_TOKEN=8066090295:AAHmPDgCvuCA7qrQAF6lGFl1j-AGSZG0zio

# Steps to regenerate:
# 1. Open Telegram and message @BotFather
# 2. Send: /mybots
# 3. Select your bot: @Authenticationfypbot
# 4. Choose "API Token"
# 5. Select "Revoke current token"
# 6. Copy the new token
# 7. Update environment variables

# New format (example):
TELEGRAM_BOT_TOKEN=your_new_telegram_bot_token_here
```

### **2. BoxHero API Token**
```bash
# Current (COMPROMISED - REMOVED FROM CODEBASE)
BOXHERO_API_TOKEN=[REMOVED_FOR_SECURITY]

# Steps to regenerate:
# 1. Login to BoxHero dashboard
# 2. Go to Settings > API
# 3. Revoke current token
# 4. Generate new token
# 5. Copy the new token
# 6. Update environment variables

# New format (example):
BOXHERO_API_TOKEN=your_new_boxhero_api_token_here
```

### **3. Supabase Service Role Key (Optional)**
```bash
# Current (Consider rotating)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Steps to regenerate (if needed):
# 1. Login to Supabase dashboard
# 2. Go to Settings > API
# 3. Generate new service role key
# 4. Update environment variables
# ⚠️ WARNING: This will break all existing service connections

# New format:
SUPABASE_SERVICE_ROLE_KEY=your_new_service_role_key_here
```

---

## 📋 **ENVIRONMENT VARIABLE UPDATE CHECKLIST**

### **Development Environment (.env.local)**
- [ ] Update `TELEGRAM_BOT_TOKEN`
- [ ] Update `BOXHERO_API_TOKEN`
- [ ] Update `SUPABASE_SERVICE_ROLE_KEY` (if rotated)

### **Production Environment (Vercel/Hosting)**
- [ ] Update `TELEGRAM_BOT_TOKEN` in production
- [ ] Update `BOXHERO_API_TOKEN` in production
- [ ] Update `SUPABASE_SERVICE_ROLE_KEY` in production (if rotated)

### **Staging Environment (if applicable)**
- [ ] Update `TELEGRAM_BOT_TOKEN` in staging
- [ ] Update `BOXHERO_API_TOKEN` in staging
- [ ] Update `SUPABASE_SERVICE_ROLE_KEY` in staging (if rotated)

---

## 🧪 **TESTING AFTER TOKEN UPDATES**

### **1. Telegram Authentication Test**
```bash
# Test endpoint (if available)
curl -X POST http://localhost:3000/api/auth/telegram/verify
# Expected: Should not return authentication errors
```

### **2. BoxHero Integration Test**
```bash
# Test sync endpoint
curl -X GET http://localhost:3000/api/boxhero/test
# Expected: Should return successful API connection
```

### **3. Admin Authentication Test**
- [ ] Navigate to `/en/fyponly-admin`
- [ ] Verify admin login works
- [ ] Check admin dashboard functionality

---

## ⚠️ **IMPORTANT NOTES**

### **Token Security Best Practices**
1. **Never commit tokens to version control**
2. **Use different tokens for development/staging/production**
3. **Rotate tokens quarterly for security**
4. **Monitor token usage and access logs**

### **Deployment Sequence**
1. **First**: Update development environment and test
2. **Second**: Update staging environment and test
3. **Third**: Update production environment
4. **Fourth**: Monitor production logs for errors

### **Rollback Plan**
If new tokens cause issues:
1. Keep old tokens temporarily available
2. Revert to old tokens if critical issues occur
3. Debug issues in development environment
4. Re-deploy with working tokens

---

## 🔍 **VERIFICATION COMMANDS**

### **Check Environment Variables**
```bash
# Development
echo $TELEGRAM_BOT_TOKEN | head -c 20
echo $BOXHERO_API_TOKEN | head -c 20

# Production (Vercel)
vercel env ls
```

### **Test API Connections**
```bash
# Test BoxHero connection
curl -H "Authorization: Bearer YOUR_NEW_TOKEN" \
     https://api.boxhero.io/v1/items

# Test Telegram bot
curl https://api.telegram.org/botYOUR_NEW_TOKEN/getMe
```

---

## 📞 **EMERGENCY CONTACTS**

### **If Tokens Don't Work**
1. **Telegram Issues**: Check @BotFather for token status
2. **BoxHero Issues**: Contact BoxHero support
3. **Supabase Issues**: Check Supabase dashboard API settings

### **Critical Error Recovery**
If production breaks after token update:
1. Immediately revert to previous working tokens
2. Check application logs for specific errors
3. Test individual API endpoints
4. Contact respective service support if needed

---

## ✅ **COMPLETION CHECKLIST**

- [ ] All tokens regenerated successfully
- [ ] Development environment updated and tested
- [ ] Staging environment updated and tested
- [ ] Production environment updated and tested
- [ ] All authentication flows verified
- [ ] Admin access confirmed working
- [ ] API integrations tested
- [ ] Old tokens revoked/disabled
- [ ] Security documentation updated
- [ ] Team notified of changes

**Status**: 🔄 **IN PROGRESS** → ✅ **COMPLETE**
