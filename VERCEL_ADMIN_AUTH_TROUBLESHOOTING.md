# 🚨 Vercel Admin Authentication Troubleshooting Guide

## 🔍 Common Issues and Solutions

### Issue 1: Admin Login Shows "Access Denied"

**Symptoms:**
- User can log in successfully but gets "Access Denied" on admin pages
- Console shows "Unauthorized admin access attempt" warnings
- Admin email is pre-filled correctly

**Root Causes & Solutions:**

#### ✅ **Solution 1: Missing ADMIN_EMAIL Environment Variable**

**Check in Vercel Dashboard:**
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Ensure `ADMIN_EMAIL` is set to your admin email address
3. **Important**: Use the exact email address that's in your Supabase auth.users table

```bash
# Required in Vercel Environment Variables
ADMIN_EMAIL=akito12350@gmail.com
```

#### ✅ **Solution 2: Admin User Not in Database**

**Verify admin user exists in Supabase:**
```sql
-- Run this query in Supabase SQL Editor
SELECT u.id, u.email, au.role, au.is_active
FROM auth.users u
LEFT JOIN admin_users au ON u.id = au.user_id
WHERE u.email = 'your_admin_email@gmail.com';
```

**If no admin_users record exists, create one:**
```sql
-- Replace 'your-user-id' with the actual user ID from the query above
INSERT INTO admin_users (user_id, role, is_active, permissions)
VALUES ('your-user-id', 'super_admin', true, '{"all": true}');
```

#### ✅ **Solution 3: Session Refresh Issues**

**Problem**: Server-side authentication not working due to missing session refresh
**Solution**: Updated middleware.ts to handle Supabase auth properly

## 🔍 Common Issues and Solutions

### Issue 1: Admin Login Shows "Access Denied" 

**Symptoms:**
- User can log in successfully but gets "Access Denied" on admin pages
- Console shows "Unauthorized admin access attempt" warnings
- Admin email is pre-filled correctly

**Root Causes & Solutions:**

#### ✅ **Solution 1: Missing ADMIN_EMAIL Environment Variable**

**Check in Vercel Dashboard:**
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Ensure `ADMIN_EMAIL` is set to your admin email address
3. **Important**: Use the exact email address that's in your Supabase auth.users table

```bash
# Required in Vercel Environment Variables
ADMIN_EMAIL=akito12350@gmail.com
```

#### ✅ **Solution 2: Admin User Not in Database**

**Verify admin user exists in Supabase:**
```sql
-- Run this query in Supabase SQL Editor
SELECT u.id, u.email, au.role, au.is_active 
FROM auth.users u 
LEFT JOIN admin_users au ON u.id = au.user_id 
WHERE u.email = 'your_admin_email@gmail.com';
```

**If no admin_users record exists, create one:**
```sql
-- Replace 'your-user-id' with the actual user ID from the query above
INSERT INTO admin_users (user_id, role, is_active, permissions)
VALUES ('your-user-id', 'super_admin', true, '{"all": true}');
```

#### ✅ **Solution 3: Session Refresh Issues**

**Problem**: Server-side authentication not working due to missing session refresh
**Solution**: Updated middleware.ts to handle Supabase auth properly

### Issue 2: Admin Config API Returns Error

**Symptoms:**
- `/api/admin/config` returns 500 error
- "Admin configuration not available" message

**Solutions:**

#### ✅ **Check Environment Variables in Vercel**
```bash
# Required in Vercel Dashboard
ADMIN_EMAIL=your_admin_email@gmail.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### ✅ **Verify API Endpoint**
Test the endpoint directly:
```bash
curl https://your-app.vercel.app/api/admin/config
```

Expected response:
```json
{
  "success": true,
  "data": {
    "adminEmail": "your_admin_email@gmail.com",
    "environment": "production"
  }
}
```

### Issue 3: "Not authenticated" Error

**Symptoms:**
- `/api/admin/check-status` returns 401 Unauthorized
- User appears logged in on frontend but server doesn't recognize session

**Solutions:**

#### ✅ **Session Cookie Issues**
1. **Check Supabase Project Settings:**
   - Go to Supabase Dashboard > Authentication > Settings
   - Ensure "Site URL" includes your Vercel domain
   - Add your Vercel domain to "Additional Redirect URLs"

2. **Verify Cookie Domain:**
   - Cookies should be set for your Vercel domain
   - Check browser dev tools > Application > Cookies

#### ✅ **Middleware Configuration**
The updated middleware.ts should handle session refresh automatically.

### Issue 4: Environment Variables Not Loading

**Symptoms:**
- Environment variables work locally but not on Vercel
- "Missing Supabase environment variables" errors

**Solutions:**

#### ✅ **Vercel Environment Variable Checklist**

**Required Variables:**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xhfmyghtcugcocchzgja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Site Configuration  
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your_production_secret_32_chars_minimum

# Admin Configuration
ADMIN_EMAIL=akito12350@gmail.com

# BoxHero Integration
BOXHERO_API_TOKEN=a827b827-36f7-4e0e-b66b-db6990469aaa

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=Authenticationfypbot
NEXT_PUBLIC_TELEGRAM_BOT_ID=8066090295
```

#### ✅ **Environment Variable Settings**
- Set all variables for **Production**, **Preview**, and **Development**
- After adding variables, **redeploy** your application
- Variables are case-sensitive

## 🧪 Testing Steps

### 1. Test Admin Config API
```bash
curl https://your-app.vercel.app/api/admin/config
```

### 2. Test Admin Authentication
1. Go to `https://your-app.vercel.app/en/fyponly-admin`
2. Check if admin email is pre-filled
3. Enter password and attempt login

### 3. Check Browser Console
- Look for authentication errors
- Check network tab for failed API calls
- Verify cookies are being set

### 4. Verify Database
```sql
-- Check admin user exists
SELECT * FROM admin_users WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'your_admin_email@gmail.com'
);
```

## 🔧 Quick Fixes

### Fix 1: Redeploy After Environment Variables
```bash
# If using Vercel CLI
vercel --prod

# Or trigger redeploy in Vercel Dashboard
```

### Fix 2: Clear Browser Cache
- Clear cookies for your domain
- Hard refresh (Ctrl+Shift+R)
- Try incognito mode

### Fix 3: Check Supabase RLS Policies
```sql
-- Verify admin_users table policies
SELECT * FROM pg_policies WHERE tablename = 'admin_users';
```

## 📞 Support Checklist

If issues persist, check:

1. ✅ All environment variables set in Vercel
2. ✅ Admin user exists in database with correct role
3. ✅ Supabase project settings include Vercel domain
4. ✅ Latest deployment includes middleware changes
5. ✅ Browser cookies are being set correctly
6. ✅ No console errors in browser dev tools

## 🚀 Production Deployment Checklist

Before going live:

- [ ] All environment variables configured in Vercel
- [ ] Admin user created in database
- [ ] Supabase project settings updated with production domain
- [ ] Admin authentication tested on production URL
- [ ] All admin features working correctly
- [ ] Security policies verified and active

Remember: Changes to environment variables require a new deployment to take effect!
