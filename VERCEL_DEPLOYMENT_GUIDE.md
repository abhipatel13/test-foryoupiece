# 🚀 Vercel Deployment Guide for ForYouPiece E-commerce

⚠️ **SECURITY WARNING**: This documentation uses placeholder values only. Never commit real API keys, tokens, or credentials to version control. Use your actual production credentials when configuring Vercel environment variables.

## Critical Environment Variables for Vercel

### Required Environment Variables

Configure these in **Vercel Dashboard > Project Settings > Environment Variables**:

| Variable Name | Value | Environment | Notes |
|---------------|-------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` | All | ✅ Safe for client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your_supabase_anon_key_here` | All | ✅ Safe for client |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_supabase_service_role_key_here` | All | ❌ Server-side only |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | Production | ✅ Safe for client |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | Production | ❌ Server-side only |
| `NEXTAUTH_SECRET` | `your-production-secret-key` | All | ❌ Server-side only |
| `BOXHERO_API_TOKEN` | `your_boxhero_api_token_here` | All | ❌ Server-side only |

### Optional Variables (for full functionality):

| Variable Name | Value | Environment | Notes |
|---------------|-------|-------------|-------|
| `TELEGRAM_BOT_TOKEN` | `your_telegram_bot_token_here` | All | ❌ Server-side only |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `your_telegram_bot_username_here` | All | ✅ Safe for client |
| `NEXT_PUBLIC_TELEGRAM_BOT_ID` | `your_telegram_bot_id_here` | All | ✅ Safe for client |
| `NEXT_PUBLIC_ADMIN_EMAIL` | `your_admin_email_here` | All | ⚠️ Development only |
| `NEXT_PUBLIC_ADMIN_TEMP_PASSWORD` | `your_admin_temp_password_here` | All | ⚠️ Development only |
| `NEXT_PUBLIC_ADMIN_EMAIL_BACKUP` | `your_backup_admin_email_here` | All | ⚠️ Development only |

## 🔧 Deployment Fixes Applied

### 1. Server Actions Configuration
- **Issue**: `serverActions.allowedOrigins` was restricted to `localhost:3000` only
- **Fix**: Added Vercel domains to allowed origins in `next.config.ts`

### 2. API Route Compatibility
- **Issue**: Inconsistent parameter handling for Next.js 15
- **Fix**: Ensured all dynamic routes use `await params` pattern

### 3. Environment Variable Handling
- **Issue**: Missing environment variables caused runtime failures
- **Fix**: Improved error logging and validation in Supabase clients

### 4. Hardcoded URLs Removed
- **Issue**: Hardcoded localhost URLs in API calls
- **Fix**: Use `NEXT_PUBLIC_SITE_URL` environment variable

## 🚨 Critical Deployment Checklist

### Before Deploying:

1. **Set Environment Variables in Vercel Dashboard**
   - All required variables from the table above
   - Use your actual Vercel domain for `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL`

2. **Verify Supabase Configuration**
   - Ensure RLS policies are properly configured
   - Test database connectivity with service role key

3. **Test Product Detail Pages**
   - Verify product SKU routing works correctly
   - Check that product data loads properly

### After Deploying:

1. **Test Critical Functionality**
   - Product detail pages: `/en/products/[sku]`
   - Admin panel: `/en/fyponly-admin`
   - Authentication flows
   - API endpoints

2. **Monitor Vercel Function Logs**
   - Check for environment variable errors
   - Verify Supabase connection success
   - Monitor API response times

## 🐛 Common Issues & Solutions

### Product Detail Pages Not Loading

**Symptoms**: 404 errors or blank pages on product detail routes

**Solutions**:
1. Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
2. Verify product SKUs exist in database
3. Check Vercel function logs for errors

### Server Actions Failing

**Symptoms**: API calls fail with CORS or origin errors

**Solutions**:
1. Verify `serverActions.allowedOrigins` includes your Vercel domain
2. Check `NEXT_PUBLIC_SITE_URL` matches your deployment URL

### Environment Variable Issues

**Symptoms**: "Missing Supabase environment variables" errors

**Solutions**:
1. Double-check all environment variables are set in Vercel dashboard
2. Ensure no typos in variable names
3. Redeploy after adding missing variables

## 📞 Support

If issues persist:
1. Check Vercel function logs in dashboard
2. Verify all environment variables are correctly set
3. Test the same functionality on localhost to isolate deployment-specific issues
4. Check Supabase logs for database connection issues

## 🔄 Deployment Commands

```bash
# Deploy to Vercel (if using Vercel CLI)
vercel --prod

# Or push to main branch if connected to GitHub
git push origin main
```

Remember: Changes to environment variables require a new deployment to take effect.
