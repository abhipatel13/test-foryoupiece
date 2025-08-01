# Facebook OAuth Authentication Fix Guide

## 🔍 **Root Cause Analysis**

Based on comprehensive testing with Playwright on the live site (https://foryoupiece.com), I've identified the following critical issues preventing Facebook OAuth from working:

### **1. Facebook App Configuration Issues** 🚨
- **Status**: Facebook app shows "App not active" - the app is in development mode
- **Domain Error**: "The domain of this URL isn't included in the app's domains"
- **App ID**: `1127347129456940` needs proper production configuration

### **2. Content Security Policy Fixed** ✅
- **Issue**: CSP was blocking worker scripts from blob URLs
- **Fix Applied**: Updated CSP to allow `blob:` in `script-src` and added `worker-src 'self' blob:`
- **Facebook Domains Added**: Added Facebook OAuth domains to CSP

### **3. Supabase Client Configuration Fixed** ✅
- **Issue**: "Service role client should not be used on client side" warnings
- **Fix Applied**: Updated TierRewardsService and CouponService to use lazy initialization
- **Result**: Service role client now only initializes on server-side

## 🛠️ **Required Facebook App Configuration**

To fix the Facebook OAuth, the following changes must be made in the Facebook Developer Console:

### **Step 1: Facebook App Settings**
1. Go to [Facebook Developers Console](https://developers.facebook.com/)
2. Navigate to your app with ID `1127347129456940`
3. Go to **Settings > Basic**

### **Step 2: Add Production Domains**
In the **App Domains** field, add:
```
foryoupiece.com
```

### **Step 3: Configure OAuth Redirect URIs**
In **Facebook Login > Settings**, add these Valid OAuth Redirect URIs:
```
https://xhfmyghtcugcocchzgja.supabase.co/auth/v1/callback
https://foryoupiece.com/en/auth/callback
```

### **Step 4: Set App to Live Mode**
1. Go to **App Review > Permissions and Features**
2. Request review for `email` permission if not already approved
3. Switch app from Development to Live mode in **Settings > Basic**

### **Step 5: Configure Site URL**
In **Settings > Basic**, set:
- **Site URL**: `https://foryoupiece.com`
- **Privacy Policy URL**: `https://foryoupiece.com/en/privacy`
- **Terms of Service URL**: `https://foryoupiece.com/en/terms`

## 🧪 **Testing Results**

### **Before Fix:**
- ❌ Facebook OAuth redirects to "App not active" error
- ❌ Domain not included in app domains error
- ❌ CSP blocking worker scripts
- ❌ Service role client warnings in console

### **After Code Fixes Applied:**
- ✅ CSP allows Facebook OAuth resources
- ✅ Service role client warnings eliminated
- ⏳ **Pending**: Facebook app configuration (requires Facebook Developer Console access)

## 🔧 **Code Changes Applied**

### **1. Content Security Policy Update**
```typescript
// next.config.ts - Updated CSP
"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://connect.facebook.net https://static.xx.fbcdn.net",
"connect-src 'self' ... https://graph.facebook.com https://www.facebook.com",
"frame-src 'self' https://accounts.google.com https://www.facebook.com",
"worker-src 'self' blob:",
```

### **2. Service Role Client Fix**
```typescript
// Updated TierRewardsService and CouponService
private getServiceClient() {
  if (!this.serviceClient && typeof window === 'undefined') {
    this.serviceClient = createServiceRoleClient()
  }
  return this.serviceClient
}
```

## 🚀 **Next Steps**

1. **Facebook App Configuration** (Critical - Requires Facebook Developer Console access)
   - Add `foryoupiece.com` to App Domains
   - Configure OAuth redirect URIs
   - Switch app to Live mode
   - Set proper site URLs

2. **Deploy Code Changes** (Ready)
   - CSP updates are ready for deployment
   - Service role client fixes are ready for deployment

3. **Test End-to-End** (After Facebook config)
   - Test Facebook OAuth on live site
   - Verify user creation in Supabase
   - Confirm authentication state management

## 📋 **Verification Checklist**

After Facebook app configuration:
- [ ] Facebook OAuth redirects to Facebook login (not error page)
- [ ] Users can complete Facebook authentication flow
- [ ] New users are created in Supabase database
- [ ] Existing users can log in via Facebook
- [ ] Authentication state shows correct userId
- [ ] No console errors related to CSP or service role client

## 🔗 **Current OAuth Flow**

The OAuth flow is correctly configured in the code:
1. User clicks Facebook login → Supabase Auth
2. Redirects to Facebook with correct parameters
3. Facebook should redirect to: `https://xhfmyghtcugcocchzgja.supabase.co/auth/v1/callback`
4. Supabase processes auth and redirects to: `https://foryoupiece.com/en/auth/callback`
5. App processes successful authentication

**The flow is correct - only Facebook app configuration is blocking it.**
