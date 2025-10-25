# Google OAuth Authentication Workflow

This document provides an in-depth analysis of the complete Google OAuth authentication workflow in the ForYouPiece e-commerce application.

## Table of Contents
1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Step-by-Step Workflow](#step-by-step-workflow)
4. [Session Management](#session-management)
5. [Profile & Data Loading](#profile--data-loading)
6. [Auto-Refresh Mechanism](#auto-refresh-mechanism)
7. [Security Features](#security-features)
8. [Browser Compatibility](#browser-compatibility)
9. [Error Handling](#error-handling)
10. [Troubleshooting](#troubleshooting)

## Overview

The Google OAuth authentication system uses Supabase Auth with PKCE (Proof Key for Code Exchange) flow to securely authenticate users. The workflow involves multiple components working together to provide a seamless authentication experience.

### Key Technologies
- **Supabase Auth**: OAuth provider integration
- **Google OAuth 2.0**: Identity provider
- **PKCE Flow**: Security enhancement for OAuth
- **JWT Tokens**: Session management
- **Zustand**: Client-side state management
- **Next.js**: Server-side routing and API handling

## Architecture Components

### Frontend Components
```
src/components/auth/
├── google-login.tsx          # Google login button component
├── auth-form.tsx            # Combined auth form with Google option
└── ChangePasswordDialog.tsx # Password management

src/lib/hooks/
└── use-ssr-safe-auth.ts     # SSR-safe authentication hooks

src/lib/providers/
└── auth-provider.tsx        # Global authentication state provider

src/lib/store/
├── user-store.ts            # User data and profile state
└── cart-store.ts            # Shopping cart state management
```

### Backend Components
```
src/app/[locale]/auth/
├── login/page.tsx           # Login page with Google OAuth
└── callback/route.ts        # OAuth callback handler

src/lib/supabase/
├── client.ts                # Browser Supabase client
├── server.ts                # Server-side Supabase client
└── queries.ts               # Database query functions

src/lib/security/
└── session-manager.ts       # Session security and management
```

## Step-by-Step Workflow

### Phase 1: User Initiates Login

#### 1.1 User Clicks "Continue with Google"
```typescript
// Location: src/components/auth/google-login.tsx
const handleGoogleSignIn = async () => {
  setLoading(true)
  await signInWithGoogle()
}
```

#### 1.2 Google OAuth Request
```typescript
// Location: src/lib/hooks/use-ssr-safe-auth.ts
const signInWithGoogle = useCallback(async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/en/auth/callback?redirectTo=${encodeURIComponent(window.location.pathname)}`,
      queryParams: {
        access_type: 'offline',    // Request refresh token
        prompt: 'select_account',  // Force account selection
      },
    }
  })
}, [supabase.auth, isClient])
```

**What happens:**
- Supabase generates OAuth URL with PKCE parameters
- Browser redirects to Google OAuth consent screen
- User authenticates with Google credentials
- Google redirects back with authorization code

### Phase 2: OAuth Callback Processing

#### 2.1 Callback Route Receives Authorization Code
```typescript
// Location: src/app/[locale]/auth/callback/route.ts
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/'
  
  console.log('🔄 Auth callback received:', {
    code: code ? 'present' : 'missing',
    redirectTo: redirectTo
  })
}
```

#### 2.2 Code Exchange for Session
```typescript
// Exchange authorization code for session tokens
const { data, error } = await supabase.auth.exchangeCodeForSession(code)

if (!error && data.session) {
  console.log('✅ Session exchanged successfully:', {
    userId: data.session.user.id,
    type: type
  })
  
  // Special handling for profile page
  if (finalRedirectTo.includes('/profile')) {
    const profileUrl = `${origin}/en/profile?refresh=${Date.now()}`
    return NextResponse.redirect(profileUrl)
  }
  
  // Add auto-refresh parameter for other pages
  const separator = finalRedirectTo.includes('?') ? '&' : '?'
  const refreshUrl = `${origin}${finalRedirectTo}${separator}refresh=${Date.now()}`
  
  return NextResponse.redirect(refreshUrl)
}
```

**Session Data Structure:**
```typescript
session = {
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  refresh_token: "v1.MjYxNDcyNzQ3NjE2NzY5NzI2NzY5...",
  expires_at: 1703123456,
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "719702ec-d425-4949-9066-e8cd20b97ce6",
    email: "user@gmail.com",
    user_metadata: {
      avatar_url: "https://lh3.googleusercontent.com/...",
      email: "user@gmail.com",
      email_verified: true,
      full_name: "User Name",
      iss: "https://accounts.google.com",
      name: "User Name",
      picture: "https://lh3.googleusercontent.com/...",
      provider_id: "123456789",
      sub: "123456789"
    },
    app_metadata: {
      provider: "google",
      providers: ["google"]
    }
  }
}
```

### Phase 3: Client-Side Session Establishment

#### 3.1 AuthProvider Detects Session
```typescript
// Location: src/lib/providers/auth-provider.tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(`[Supabase Auth] Event received: ${event}`)
  
  switch (event) {
    case 'INITIAL_SESSION':
    case 'SIGNED_IN': {
      const user = session?.user
      if (user) {
        // Set user in store immediately
        useUserStore.getState().setUser(user)
        
        // Broadcast to other tabs
        channel.postMessage({ type: 'SIGNED_IN' })
        
        // Fetch user profile
        try {
          const profile = await userQueries.getProfile(user.id)
          if (useUserStore.getState().user?.id === user.id) {
            useUserStore.getState().setProfile(profile)
            useCartStore.getState().setUserId(user.id)
            useCartStore.getState().forceLoadCartForUser(user?.id)
          }
        } catch (error) {
          console.error('Failed to fetch profile:', error)
          useUserStore.getState().setProfile(null)
        }
      }
      break;
    }
  }
})
```

#### 3.2 Auto-Refresh Detection
```typescript
// Location: src/components/layout/main-layout.tsx
useEffect(() => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search)
    const refreshParam = urlParams.get('refresh')
    const currentPath = window.location.pathname
    
    if (refreshParam) {
      console.log('🔄 Google OAuth auto-refresh triggered for:', currentPath)
      
      // Special handling for profile page
      if (currentPath.includes('/profile')) {
        console.log('📋 Profile page detected - ensuring profile data loads')
      }
      
      // Remove refresh parameter and reload page
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('refresh')
      window.history.replaceState({}, '', newUrl.toString())
      
      setTimeout(() => {
        console.log('🔄 Executing page reload for:', currentPath)
        window.location.reload()
      }, 100)
    }
  }
}, [])
```

## Session Management

### Session Configuration
```typescript
// Location: src/lib/supabase/client.ts
const authConfig = {
  autoRefreshToken: true,                    // Auto-refresh expired tokens
  persistSession: true,                      // Save session in browser storage
  detectSessionInUrl: true,                  // Detect session from OAuth callback URL
  flowType: 'pkce',                         // PKCE flow for security
  sessionTimeout: 8 * 60 * 60 * 1000,      // 8 hours session timeout
  refreshTokenRotation: true,                // Rotate refresh tokens for security
  refreshTokenGracePeriod: 5 * 60 * 1000,   // 5 minutes grace period
}
```

### Browser-Specific Optimizations
```typescript
// Firefox optimizations
if (browser.name === 'firefox') {
  authConfig.sessionTimeout = 6 * 60 * 60 * 1000 // 6 hours
}

// Safari optimizations
if (browser.name === 'safari') {
  authConfig.sessionTimeout = 4 * 60 * 60 * 1000 // 4 hours
}

// Chrome optimizations
if (browser.name === 'chrome') {
  authConfig.sessionTimeout = 8 * 60 * 60 * 1000 // 8 hours
  authConfig.refreshTokenGracePeriod = 10 * 60 * 1000 // 10 minutes
}
```

### Token Storage
- **Primary Storage**: Browser localStorage (Supabase default)
- **Fallback Storage**: Memory storage for private browsing
- **Cross-Tab Sync**: BroadcastChannel API for multi-tab synchronization
- **Security**: Tokens are stored securely with automatic cleanup

## Profile & Data Loading

### Profile Fetching Process
```typescript
// Location: src/lib/supabase/queries.ts
async getProfile(userId: string) {
  // Check cache first
  const cacheKey = cacheKeys.userProfile(userId)
  const cachedProfile = cache.get(cacheKey)
  if (cachedProfile) {
    return cachedProfile
  }

  // Query database
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, email, phone, first_name, last_name, avatar_url,
      points_balance, total_points_earned, tier_level, total_spent, total_orders,
      preferred_language, created_at, updated_at,
      address_line_1, address_line_2, aba_bank_name,
      permanent_free_shipping
    `)
    .eq('id', userId)
    .single()

  // Cache successful result
  if (data) {
    cache.set(cacheKey, data, 300000) // 5 minutes cache
  }

  return data
}
```

### Cart Loading Process
```typescript
// Location: src/lib/store/cart-store.ts
forceLoadCartForUser: async (userId: string) => {
  console.log('🛒 Force loading cart for authenticated user:', { userId })
  
  // Clear existing cart
  set({ items: [], isLoading: true })
  
  // Load from database
  const response = await fetch(`/api/cart?userId=${userId}`)
  const data = await response.json()
  
  if (data.success) {
    set({
      items: data.items,
      isLoading: false,
      lastSyncedAt: Date.now()
    })
  }
}
```

## Auto-Refresh Mechanism

### Why Auto-Refresh is Needed
Google OAuth creates a race condition where:
1. Session is established but profile doesn't exist in database yet
2. AuthProvider tries to fetch profile → fails because profile not created
3. User sees incomplete data until manual refresh

### Auto-Refresh Implementation

#### Server-Side (Callback)
```typescript
// Add refresh parameter to redirect URL
if (finalRedirectTo.includes('/profile')) {
  const profileUrl = `${origin}/en/profile?refresh=${Date.now()}`
  return NextResponse.redirect(profileUrl)
}

const separator = finalRedirectTo.includes('?') ? '&' : '?'
const refreshUrl = `${origin}${finalRedirectTo}${separator}refresh=${Date.now()}`
return NextResponse.redirect(refreshUrl)
```

#### Client-Side (MainLayout)
```typescript
// Detect refresh parameter and trigger reload
if (refreshParam) {
  // Clean URL to prevent infinite refresh
  const newUrl = new URL(window.location.href)
  newUrl.searchParams.delete('refresh')
  window.history.replaceState({}, '', newUrl.toString())
  
  // Reload page after small delay
  setTimeout(() => {
    window.location.reload()
  }, 100)
}
```

### Auto-Refresh Flow
1. **OAuth Callback** → Adds `?refresh=timestamp` to redirect URL
2. **Page Loads** → MainLayout detects refresh parameter
3. **URL Cleanup** → Removes refresh parameter from URL
4. **Page Reload** → Triggers fresh page load with established session
5. **Profile Loads** → AuthProvider successfully fetches profile data

## Security Features

### PKCE (Proof Key for Code Exchange)
- **Code Verifier**: Random string generated by client
- **Code Challenge**: SHA256 hash of code verifier
- **Protection**: Prevents authorization code interception attacks

### Token Security
```typescript
// Token rotation on refresh
refreshTokenRotation: true

// Blacklist invalid tokens
await blacklistToken(session.access_token, userId, 'user_logout')

// Grace period for token refresh
refreshTokenGracePeriod: 5 * 60 * 1000
```

### Session Validation
```typescript
// Enhanced session validation
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  // Check in-memory cache first
  const cachedEntry = tokenBlacklist.get(token)
  if (cachedEntry) {
    const expirationTime = cachedEntry.blacklistedAt + (24 * 60 * 60 * 1000)
    if (Date.now() > expirationTime) {
      tokenBlacklist.delete(token)
    } else {
      return true
    }
  }

  // Check database
  const { data } = await serviceClient
    .from('blacklisted_tokens')
    .select('id')
    .eq('token_hash', await hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .single()

  return !!data
}
```

## Browser Compatibility

### Storage Handling
```typescript
class CrossBrowserStorage {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      // Fallback for Safari private mode
      return this.memoryStorage.get(key) ?? null
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Fallback to memory storage
      this.memoryStorage.set(key, value)
    }
  }
}
```

### Browser-Specific Timeouts
| Browser | Session Timeout | Reason |
|---------|----------------|---------|
| Chrome | 8 hours | Handles longer sessions well |
| Firefox | 6 hours | Memory management considerations |
| Safari | 4 hours | Strict cookie and storage policies |

## Error Handling

### OAuth Errors
```typescript
// Handle OAuth callback errors
if (error) {
  if (errorCode === 'otp_expired' || error === 'access_denied') {
    return NextResponse.redirect(`${origin}/en/auth/forgot-password?error=expired_link`)
  }
  
  return NextResponse.redirect(`${origin}/en/auth/login?error=auth_error&details=${encodeURIComponent(errorDescription || error)}`)
}
```

### Session Errors
```typescript
// Handle session establishment errors
if (!data.session) {
  console.error('❌ No session returned from code exchange')
  return NextResponse.redirect(`${origin}/en/auth/login?error=no_session&details=Failed to establish session`)
}
```

### Profile Loading Errors
```typescript
// Handle profile fetch errors
try {
  const profile = await userQueries.getProfile(user.id)
  useUserStore.getState().setProfile(profile)
} catch (error) {
  console.error('Failed to fetch profile:', error)
  useUserStore.getState().setProfile(null)
}
```

## Troubleshooting

### Common Issues

#### 1. Profile Not Loading After Google Login
**Symptoms:**
- User appears logged in but profile data is missing
- Points balance shows as 0 or undefined
- Cart doesn't load properly

**Solution:**
- Auto-refresh mechanism should handle this automatically
- Check console for refresh parameter detection
- Verify profile exists in database

#### 2. Infinite Refresh Loop
**Symptoms:**
- Page keeps reloading continuously
- Browser becomes unresponsive
- Console shows repeated refresh messages

**Solution:**
- Check if refresh parameter is being properly removed from URL
- Verify `window.history.replaceState()` is working
- Clear browser storage if needed

#### 3. Cross-Tab Authentication Issues
**Symptoms:**
- Login in one tab doesn't reflect in other tabs
- Inconsistent authentication state across tabs

**Solution:**
- Verify BroadcastChannel is working
- Check for localStorage access permissions
- Ensure AuthProvider is properly initialized

### Debug Console Messages

#### Successful Flow:
```
🔄 Auth callback received: {code: 'present', redirectTo: '/en/profile'}
✅ Session exchanged successfully: {userId: '...', type: null}
🔄 Redirecting to profile page with auto-refresh: https://site.com/en/profile?refresh=1703123456
🔄 Google OAuth auto-refresh triggered for: /en/profile
📋 Profile page detected - ensuring profile data loads
🔄 Executing page reload for: /en/profile
[Supabase Auth] Event received: INITIAL_SESSION
🏪 User store setUser called: {userId: '...', email: '...'}
🔎 setProfile received points_balance: 1000
🛒 Cart loaded successfully: {itemCount: 11, totalQuantity: 11}
```

#### Error Flow:
```
❌ Auth callback exception: Error message
❌ Session exchange failed: Error details
❌ Failed to fetch profile: Database error
```

### Performance Monitoring

#### Key Metrics:
- **Session establishment time**: < 2 seconds
- **Profile loading time**: < 1 second
- **Auto-refresh trigger time**: < 500ms
- **Total authentication flow**: < 5 seconds

#### Optimization Tips:
1. **Cache profile data** for 5 minutes to reduce database queries
2. **Preload cart data** immediately after authentication
3. **Use request deduplication** to prevent duplicate API calls
4. **Implement proper error boundaries** to handle authentication failures gracefully

## Conclusion

The Google OAuth authentication workflow in ForYouPiece is a comprehensive system that handles:

- **Secure Authentication**: PKCE flow with token rotation
- **Session Management**: Browser-specific optimizations and automatic refresh
- **Data Loading**: Profile and cart synchronization
- **Error Handling**: Comprehensive error recovery and user feedback
- **Performance**: Optimized loading and caching strategies
- **Cross-Platform**: Support for all major browsers and devices

The auto-refresh mechanism ensures that users have a seamless experience regardless of the OAuth timing complexities, while the security features protect against common authentication vulnerabilities.
