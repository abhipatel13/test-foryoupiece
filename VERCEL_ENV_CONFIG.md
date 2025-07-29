# Vercel Environment Variables Configuration

## 🚨 URGENT: Authentication Redirect Issue Fix

**Problem**: Authentication redirects to `localhost:3000` instead of production domain
**Cause**: Environment variables in Vercel dashboard still point to localhost
**Solution**: Update these specific variables in Vercel Dashboard

## 🔧 Required Environment Variables for Vercel

### **Critical Variables to Update:**

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://foryoupiece-web-git-main-akito1013s-projects.vercel.app` | Production |
| `NEXTAUTH_URL` | `https://foryoupiece-web-git-main-akito1013s-projects.vercel.app` | Production |
| `NODE_ENV` | `production` | Production |

### **Complete Environment Variables List:**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xhfmyghtcugcocchzgja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZm15Z2h0Y3VnY29jY2h6Z2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MjgwMzAsImV4cCI6MjA2ODQwNDAzMH0.75nm-mC073DP-5m7efcJlRgS00cT1VBxR9mONHvTNUo
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Site Configuration (CRITICAL - MUST BE PRODUCTION DOMAIN)
NEXT_PUBLIC_SITE_URL=https://foryoupiece-web-git-main-akito1013s-projects.vercel.app
NEXTAUTH_URL=https://foryoupiece-web-git-main-akito1013s-projects.vercel.app
NEXTAUTH_SECRET=your_cryptographically_strong_secret_here

# BoxHero Integration
BOXHERO_API_TOKEN=your_boxhero_api_token_here

# Admin Authentication (Server-side only)
ADMIN_EMAIL=akito12350@gmail.com

# Environment
NODE_ENV=production

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_telegram_bot_username_here
NEXT_PUBLIC_TELEGRAM_BOT_ID=your_telegram_bot_id_here
```

## 📋 Step-by-Step Instructions

### 1. Access Vercel Dashboard
- Go to [vercel.com](https://vercel.com)
- Navigate to your project: `foryoupiece-web-git-main-akito1013s-projects`
- Click **Settings** → **Environment Variables**

### 2. Update Critical Variables
Update these three variables immediately:
- `NEXT_PUBLIC_SITE_URL`
- `NEXTAUTH_URL` 
- `NODE_ENV`

### 3. Verify All Variables
Ensure all variables from the list above are present and correct.

### 4. Redeploy
- Go to **Deployments** tab
- Click **Redeploy** on latest deployment
- Wait for deployment to complete

### 5. Test Authentication
- Visit your production site
- Try logging in with Google OAuth
- Should redirect to production domain, not localhost

## 🔍 Verification Checklist

After updating environment variables:
- [ ] `NEXT_PUBLIC_SITE_URL` points to production domain
- [ ] `NEXTAUTH_URL` points to production domain  
- [ ] `NODE_ENV` is set to `production`
- [ ] All Supabase variables are present
- [ ] Deployment completed successfully
- [ ] Authentication redirects to production domain
- [ ] No localhost:3000 redirects occur

## 🚨 Common Issues

**Issue**: Still redirecting to localhost after updating variables
**Solution**: 
1. Clear browser cache and cookies
2. Try incognito/private browsing mode
3. Verify variables are saved in Vercel dashboard
4. Check deployment logs for any errors

**Issue**: Environment variables not taking effect
**Solution**:
1. Ensure variables are set for "Production" environment
2. Redeploy the application after setting variables
3. Check that variable names are exactly correct (case-sensitive)
