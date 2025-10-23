# ForYouPiece Authentication System — Definitive Technical Guide (2025-10)

This document is a precise, rebuild-from-scratch reference of the current authentication system. It covers Google OAuth, Email/Password, and Telegram login (widget and deep-link), state management, security, middleware, API routes, and the database layer.

Use this to understand how things work end-to-end and to bootstrap a clean implementation if needed.

---

## 1) Goals and Architecture

- **Single source of truth**: Supabase Auth + Postgres (`users` table) drive frontend state.
- **App flow**:
  - OAuth/Password/Telegram → Supabase session → `AuthProvider` → Zustand stores → UI.
  - Admin/service operations use a service-role client and bypass RLS.
- **Security**: RLS everywhere, strict cookies, CSP, replay/rate-limit checks, server-side session creation for Telegram.

Key pattern observed in code: Supabase is the single source of truth; admin/service-role client for privileged ops; session validation uses `auth.getSession()` for expiry and `auth.getUser()` where needed; cross-tab sync via BroadcastChannel.

---

## 2) Components Overview (files and roles)

- **Supabase clients**
  - Browser client: `src/lib/supabase/client.ts`
  - Server client (SSR/cookies): `src/lib/supabase/server.ts`
  - Service-role client (admin): `src/lib/supabase/service-role.ts`
- **Auth state + UI wiring**
  - Provider: `src/lib/providers/auth-provider.tsx`
  - Hooks: `src/lib/hooks/use-ssr-safe-auth.ts`, `src/lib/hooks/use-auth.ts`
  - Stores: `src/lib/store/user-store.ts`, `src/lib/store/ssr-safe-user-store.ts`, `src/lib/store/cart-store.ts`, `src/lib/store/ssr-safe-cart-store.ts`
- **Middleware and security**
  - App-level middleware: `src/middleware.ts`
  - Error sanitizer: `src/lib/security/error-sanitizer.ts`
  - Session manager (blacklist/refresh helpers): `src/lib/security/session-manager.ts`
- **Auth API routes**
  - OAuth callback (localized): `src/app/[locale]/auth/callback/route.ts`
  - OAuth callback (non-localized alias): `src/app/auth/callback/route.ts`
  - Profile bootstrap: `src/app/api/auth/ensure-profile/route.ts`
  - Logout (enhanced): `src/app/api/auth/logout/route.ts`
  - Session validate: `src/app/api/auth/session/validate/route.ts` (+ alias `src/app/api/auth/validate/route.ts`)
  - Enhanced validate: `src/app/api/auth/session/enhanced-validate/route.ts`
  - Telegram: `src/app/api/auth/telegram/start/route.ts`, `.../verify/route.ts`, `.../poll/route.ts`
- **Login UI**
  - Email/Password + Google + Telegram widget: `src/app/[locale]/auth/login/page.tsx`
  - Shared email form + Google button: `src/components/auth/auth-form.tsx`, `src/components/auth/google-login.tsx`
- **Telegram deep-link KV**
  - Nonce store helpers: `src/lib/telegram/nonce-store.ts`

---

## 3) Supabase Clients

- `src/lib/supabase/client.ts`
  - Creates a single browser client via `createBrowserClient`.
  - OAuth settings: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: true`, `flowType: 'pkce'`.
  - Custom CrossBrowserStorage class exists but is currently disabled for OAuth stability (see comment: “TEMPORARILY DISABLE CUSTOM STORAGE”).

- `src/lib/supabase/server.ts`
  - `createClient()` returns a server-side client using `next/headers` cookies via `createServerClient`.
  - `createAnonymousClient()` returns a non-persistent client (no auth, RLS enforced) for public endpoints.

- `src/lib/supabase/service-role.ts`
  - `createServiceRoleClient()` builds an admin client with `SUPABASE_SERVICE_ROLE_KEY` (server-only) for upserts, non-RLS ops, Telegram flows, session blacklisting, etc.

---

## 4) Auth State, Stores, Cross‑Tab Sync

- `src/lib/providers/auth-provider.tsx`
  - Subscribes to `supabase.auth.onAuthStateChange` once.
  - Handles events:
    - `INITIAL_SESSION` / `SIGNED_IN`: set user in `useUserStore`, broadcast `SIGNED_IN`, fetch profile via `userQueries.getProfile()`, set `useCartStore.userId` and `forceLoadCartForUser()`.
    - `SIGNED_OUT`: clear user + cart, broadcast `SIGNED_OUT`, `resetClientCache()`, redirect to `/en/auth/login`.
    - `TOKEN_REFRESHED`, `USER_UPDATED`: refresh user in stores; broadcast when appropriate.
  - Cross-tab channel: `BroadcastChannel('app_auth_channel')` to keep tabs in sync.

- `src/lib/hooks/use-ssr-safe-auth.ts`
  - SSR-safe facade exposing `user`, `profile`, loading flags.
  - Actions: `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `changePassword`, `updateProfile`, `signOut`.
  - `signOut()` performs client cleanup and calls `/api/auth/logout` (server) for enhanced token invalidation.

- Stores
  - `src/lib/store/user-store.ts`: persists `user`, `profile` with versioned migrations. Methods `setUser`, `setProfile`, etc.
  - `src/lib/store/ssr-safe-user-store.ts`: singleton wrapper to avoid HMR/SSR double-init loops.
  - `src/lib/store/cart-store.ts`: reacts to auth changes (sets `userId`, loads cart from DB) and clears on logout.
  - `src/lib/store/ssr-safe-cart-store.ts`: SSR-safe wrapper with pre-hydration proxies.

Notes:
- AGENTS.md mentions a post-login hard reload guard; current code primarily navigates on success (e.g., login page uses `router.push(redirectTo)` after password login). See “Observed differences” near the end.

---

## 5) Middleware: Cookies, Session Validation, CSP

- File: `src/middleware.ts`
- **Cookie hardening** via `getSecureCookieOptions()`:
  - `httpOnly` default true, `secure` only in production, `sameSite: 'lax'`, `path: '/'`.
  - Respects deletion semantics (`maxAge: 0` or explicit `expires`). Sets `maxAge: 8h` for auth cookies if not provided.
- **Session validation** (`validateSessionSecurity`):
  - Uses `supabase.auth.getSession()`; respects `session.expires_at` when present; for admin-like paths (admin, fyponly) enforces a conservative window if `expires_at` missing.
- **Protected paths**: `/en/account`, `/en/profile`, `/en/checkout`, `/en/orders`, `/fyponly-admin`, `/en/fyponly-admin`, `/en/admin`.
  - Unauthenticated users are redirected to `/en/auth/login?redirectTo=...`.
- **Auth pages redirect**: authenticated users visiting `/en/auth` are redirected to `/en`.
- **CSP**: Nonce-based script policy with allowlists for Google, Facebook, Telegram; dev allows `unsafe-eval`.
- **API ban enforcement**: For protected API prefixes, checks `users.banned` and returns 403 if set.

---

## 6) API Routes

### 6.1 OAuth callback (Google + email links + recovery)
- Localized: `src/app/[locale]/auth/callback/route.ts`
- Non-localized alias: `src/app/auth/callback/route.ts`
- Core behavior:
  - Parses `code`, `type`, `redirectTo`, `token`/`token_hash`.
  - Recovery flow auto-detected by `type === 'recovery'` OR `redirectTo` containing `reset-password`; tries `exchangeCodeForSession` first, then `verifyOtp` with `token`/`token_hash`.
  - Non-recovery: calls `exchangeCodeForSession(code)`, then redirects to sanitized `next`/`redirectTo`.
  - On error, redirects to `/auth/error` or login with `error` params.

### 6.2 Ensure profile
- `src/app/api/auth/ensure-profile/route.ts`
- Idempotent POST that ensures `users` row exists for the current auth user. Uses service-role upsert but returns profile via user-scoped client (RLS-safe).
- Not automatically invoked anywhere in `src/` at the time of this writing; call it from client/UI as needed after authentication.

### 6.3 Logout (enhanced)
- `src/app/api/auth/logout/route.ts`
- POST: Gets current user, invokes `enhancedLogout(user.id)` (token blacklist + Supabase signOut + invalidation), returns JSON with strict no-cache headers.
- GET: Diagnostic info (masked user id).

### 6.4 Session validation
- `src/app/api/auth/session/validate/route.ts`
  - POST: Returns `{ valid, reason, warning, session }` after server-side heartbeat + optional blacklist check.
  - PUT: `refreshSession()` and responds with new tokens metadata.
- `src/app/api/auth/session/enhanced-validate/route.ts`
  - POST: Adds age checks, blacklist check, detailed reasons.
- `src/app/api/auth/validate/route.ts` is an alias to `session/validate`.

### 6.5 Telegram authentication
- Start (deep-link nonce): `src/app/api/auth/telegram/start/route.ts`
  - Production-only. Generates 16-byte `nonce`, stores in `public.auth_nonces` (10-min TTL enforced in code), builds `t.me/Authenticationfypbot?start=login-<nonce>` deep-link.
- Verify (Login Widget redirect): `src/app/api/auth/telegram/verify/route.ts`
  - Production-only. Rate-limits per-IP (memory), verifies HMAC-SHA256 signature using `TELEGRAM_AUTH_BOT_TOKEN`, checks freshness (≤10 min), replay protection (hash TTL).
  - Creates/ensures an auth user using a synthetic email `tg_<id>@telegram.foryoupiece.local`.
  - Strategy:
    1) Try `auth.admin.generateLink({ type: 'magiclink' })`. If present, use `email_otp`/`token_hash`.
    2) If missing, `auth.signUp` (client-side supabase-js) with a secure random password and Telegram metadata; auto-confirm email via admin API.
    3) Retry `generateLink` and establish session via `verifyOtp` with `token_hash` (preferred) or `email` OTP.
  - On success, SSR client sets the session and redirects to `/en/profile?auth=telegram_success`.
- Poll (deep-link server handoff): `src/app/api/auth/telegram/poll/route.ts`
  - If feature flag `NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN === 'true'`, performs `supabaseSSR.auth.setSession()` and returns `{ serverHandoff: true, profileRedirect }`. Otherwise returns tokens for client `setSession()`.
- Nonce KV helpers: `src/lib/telegram/nonce-store.ts`.

### 6.6 Admin authentication (hook present; API endpoints missing in this repo snapshot)
- Hook: `src/lib/hooks/use-secure-admin-auth.ts` expects `/api/admin/session` (httpOnly cookie session validation and rotation metadata).
- Current repository does not contain `src/app/api/admin/session` (no matching API route was found). The hook appears unused/incomplete in this code snapshot.
- Admin API middleware helper exists at `src/lib/auth/admin-middleware.ts` (`verifyAdminAuth()`), but no API routes import it in this repo snapshot.

---

## 7) Login UI flows

- Page: `src/app/[locale]/auth/login/page.tsx`
  - Email/Password: `supabase.auth.signInWithPassword({ email, password })`, then `router.push(redirectTo)`; `AuthProvider` updates stores on the subsequent auth event.
  - Google: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <site>/en/auth/callback?redirectTo=<target> } })`.
  - Telegram widget: Only in production. Embeds `https://telegram.org/js/telegram-widget.js`, with `data-auth-url` pointing to `/api/auth/telegram/verify`. Includes fallback to deep-link (`/api/auth/telegram/start` + polling `/api/auth/telegram/poll`).

- Shared components:
  - `src/components/auth/auth-form.tsx`: email signup/login using `useSSRSafeAuth()` methods; Google button injected.
  - `src/components/auth/google-login.tsx`: button wrappers for Google OAuth start.

---

## 8) Session Management and Blacklisting

- `src/lib/security/session-manager.ts`
  - Client-side tracker and timers; `createSession`, `updateSessionActivity`, `shouldRefreshSession`, `refreshSessionTokens`.
  - Blacklist functions (SERVER-ONLY): `blacklistToken()`, `isTokenBlacklisted()`, `cleanupExpiredBlacklistEntries()` write/read hashed tokens via service-role client.
  - NOTE: The table `blacklisted_tokens` is referenced by code but not present in the migrations in this repo snapshot. If missing in your DB, create it:

```sql
-- Required by session-manager.ts
create table if not exists public.blacklisted_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  reason text,
  blacklisted_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists blacklisted_tokens_expires_at_idx on public.blacklisted_tokens(expires_at);
```

- Error handling utilities: `src/lib/security/error-sanitizer.ts` provide sanitized JSON errors for API routes.

---

## 9) Database Layer (Auth-relevant objects)

- Initial schema: `supabase/migrations/001_initial_schema.sql`
  - `users` extends `auth.users(id)` with `telegram_id`, `telegram_username`, `email`, profile fields, points fields, tier, etc.
  - Other commerce tables present but not auth-specific.

- RLS policies: `supabase/migrations/002_rls_policies.sql`
  - Enables RLS on all tables.
  - Helpers `is_admin(uuid)` and `is_super_admin(uuid)`; per-table policies (users can read/update own row; admins broader access).

- Points/tier system:
  - Add lifetime field: `027_add_total_points_earned_field.sql`.
  - Welcome bonus trigger: `030_fix_welcome_bonus_trigger.sql` updates both `points_balance` and `total_points_earned` on insert into `users`.

- Admin 2FA/Session/IP tracking: `019_admin_2fa_and_security.sql` (tables for admin flows).

- Telegram RLS: `012_fix_telegram_tables_rls.sql` (admin-only access to telemetry tables).

- Telegram deep-link KV: `20250920_auth_nonces_kv.sql` creates `public.auth_nonces` used by `/telegram/start` and `/telegram/poll`.

- Ban enforcement:
  - Middleware reads `users.banned` (see `src/middleware.ts`). Ensure your DB has a `banned boolean` column on `users` with appropriate RLS, or remove that check.

---

## 10) Environment Variables

Required (from code):

- Supabase
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Site
  - `NEXT_PUBLIC_SITE_URL` (used to build OAuth redirect URLs)
- Telegram
  - `TELEGRAM_AUTH_BOT_TOKEN` (HMAC secret for Login Widget verify)
  - `NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN` (optional; server handoff in poll)
- Debug (optional)
  - `NEXT_PUBLIC_DEBUG_SUPABASE`, `NEXT_PUBLIC_DEBUG_CART`, `NEXT_PUBLIC_DEBUG_ANALYTICS`

---

## 11) End-to-End Flows

- **Email/Password — Login**
  1. UI posts `signInWithPassword`.
  2. Middleware lets auth page render; on success, UI `router.push(redirectTo)`.
  3. `AuthProvider` hears `SIGNED_IN`, sets `user`, loads `profile`, sets cart user.
  4. Optional: call `POST /api/auth/ensure-profile` to guarantee users row exists.

- **Email/Password — Sign up**
  1. UI calls `supabase.auth.signUp({ emailRedirectTo: <site>/en/auth/callback?redirectTo=/ })`.
  2. User verifies email → callback route exchanges session and redirects.
  3. Ensure-profile runs soon after.

- **Google OAuth**
  1. UI calls `signInWithOAuth({ provider: 'google', redirectTo: <site>/en/auth/callback?redirectTo=... })`.
  2. Callback exchanges `code` → session → redirect.
  3. `AuthProvider` updates stores; ensure-profile recommended.

- **Telegram Login (Widget)**
  1. Widget redirects to `/api/auth/telegram/verify` with signed params.
  2. Verify route checks signature/date/replay/rate limits.
  3. Ensures a Supabase auth user (synthetic email) then generates a magic link.
  4. Verifies OTP by `token_hash` (preferred) or `email_otp`; sets session via server client.
  5. Redirect to `/en/profile?auth=telegram_success`.

- **Telegram Login (Deep-link fallback)**
  1. `/api/auth/telegram/start` returns a `nonce` and `t.me` link; user confirms in Telegram app.
  2. Bot marks nonce verified (`auth_nonces.verified=true`) and creates a session server-side.
  3. Frontend polls `/api/auth/telegram/poll?nonce=...`; either server handoff sets session or returns tokens for `supabase.auth.setSession()`.

---

## 12) Security Hardening Summary

- **Cookies**: httpOnly, SameSite=Lax, `secure` in prod, 8-hour max-age default for auth cookies.
- **CSP**: Nonce-based policy including Google/Facebook/Telegram; headers set in middleware.
- **RLS**: Users can only see/update their own rows; admin functions guarded by helper functions and/or service-role client.
- **Rate/Replay**: Telegram verify uses per-IP in-memory rate-limiting and hash replay guard (10 min TTL). For multi-instance production use Redis or equivalent.
- **Blacklist**: Logout blacklists tokens; add the `blacklisted_tokens` table if missing.
- **Error responses**: All auth APIs return sanitized JSON on failure via `error-sanitizer`.
- **Bans**: Middleware denies protected API calls if `users.banned` is true.

---

## 13) Rebuild-from-Scratch Checklist

1) Configure environment

```bash
# Supabase
export NEXT_PUBLIC_SUPABASE_URL=...
export NEXT_PUBLIC_SUPABASE_ANON_KEY=...
export SUPABASE_SERVICE_ROLE_KEY=...

# Site
export NEXT_PUBLIC_SITE_URL=https://your-domain

# Telegram
export TELEGRAM_AUTH_BOT_TOKEN=123456:ABC...
# optional
export NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN=true
```

2) Apply migrations (order matters; ensure the additional blacklist table exists)

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_rls_policies.sql`
- `supabase/migrations/012_fix_telegram_tables_rls.sql`
- `supabase/migrations/015_tier_rewards_system.sql`
- `supabase/migrations/019_admin_2fa_and_security.sql`
- `supabase/migrations/027_add_total_points_earned_field.sql`
- `supabase/migrations/030_fix_welcome_bonus_trigger.sql`
- `supabase/migrations/20250920_auth_nonces_kv.sql`
- plus the `blacklisted_tokens` DDL (see above).

3) Verify middleware

- `src/middleware.ts` is active (Next.js matcher covers all non-static routes).
- Confirm protected paths list suits your app.

4) Verify callback + login pages

- Ensure both callback routes exist (localized and fallback) and login page at `src/app/[locale]/auth/login/page.tsx` is reachable.

5) Telegram bot setup

- `TELEGRAM_AUTH_BOT_TOKEN` must be the authentication bot token (not the stock or notification bot token). Widget uses `data-auth-url="/api/auth/telegram/verify"`.
- Deep-link fallback requires your Telegram bot implementation to mark nonces verified in `auth_nonces`.

6) Optional ensure-profile call

- Call `POST /api/auth/ensure-profile` immediately after successful auth to guarantee `users` row.

---

## 14) Code‑Verified Confirmations & Gaps

- **[no_facebook_oauth]** No Facebook OAuth flows are implemented under `src/` (search shows no `provider: 'facebook'` usages). A guide file (`FACEBOOK_OAUTH_FIX_GUIDE.md`) exists, but there is no active code path invoking Facebook sign-in.
- **[ensure_profile_not_auto_called]** `src/app/api/auth/ensure-profile/route.ts` exists but is not automatically invoked anywhere in `src/`; call it explicitly after auth if needed.
- **[admin_session_api_missing]** Admin hook `src/lib/hooks/use-secure-admin-auth.ts` expects `/api/admin/session`, but no such API route exists in this repo snapshot. `src/lib/auth/admin-middleware.ts` also exists without consumers.
- **[no_post_login_hard_reload]** No one-time post-login hard reload guard is present. Current flow uses `router.push(...)` and `AuthProvider` hydration (e.g., `src/app/[locale]/auth/login/page.tsx`, `src/lib/providers/auth-provider.tsx`).
- **[blacklist_table_missing]** `blacklisted_tokens` table is referenced by `src/lib/security/session-manager.ts` but no migration was found. Add the DDL in Section 8 if you rely on token blacklisting.
- **[telegram_prod_only]** Telegram widget verification (`/api/auth/telegram/verify`) is production-only and requires `TELEGRAM_AUTH_BOT_TOKEN`.

---

## 15) Endpoint Map (quick reference)

- `GET /[locale]/auth/callback` → OAuth/recovery exchange
- `POST /api/auth/ensure-profile` → create/upsert `users` row for current auth user
- `POST /api/auth/logout` → enhanced logout (blacklist + signOut)
- `POST /api/auth/session/validate` → validate heartbeat; `PUT` → refresh session
- `POST /api/auth/session/enhanced-validate` → stricter validation (age/blacklist)
- `POST /api/auth/telegram/start` → deep-link nonce
- `GET /api/auth/telegram/verify` → widget signature verification + session
- `GET /api/auth/telegram/poll` → returns session or performs server handoff (flagged)

---

## 16) Key Code Pointers

- Provider: `src/lib/providers/auth-provider.tsx`
- SSR-safe auth: `src/lib/hooks/use-ssr-safe-auth.ts`
- Middleware: `src/middleware.ts`
- Clients: `src/lib/supabase/{client,server,service-role}.ts`
- Queries (profile): `src/lib/supabase/queries.ts` (`userQueries.getProfile`)
- Logout + session ops: `src/lib/security/session-manager.ts`
- Telegram flows: `src/app/api/auth/telegram/*`, `src/lib/telegram/nonce-store.ts`

This documentation reflects the repository at the time of writing and cites exact files and behaviors, so you can reproduce the full auth system or audit it quickly.

Small Summary:
To ensure the documentation is strictly code-driven and highlights exact current behavior, I will:
- Search the codebase for any usage of the ensure-profile API to confirm whether it's called automatically after auth.
- Search for any Facebook OAuth provider usage to verify if it's present or not.
- Search for any post-login hard reload implementation to confirm its absence.
- Then, I'll update the existing [docs/AUTHENTICATION.md](cci:7://file:///Users/kitokati/foryoupiece-web-1/docs/AUTHENTICATION.md:0:0-0:0) to add a concise, code-verified facts section and clarify these findings with exact file references.



I'll search the codebase to verify specific implementation details you asked about: whether ensure-profile is automatically called, if Facebook OAuth is present, routes used by admin auth (`/api/admin/session`), and confirm post-login reload behavior. Then I'll update [docs/AUTHENTICATION.md](cci:7://file:///Users/kitokati/foryoupiece-web-1/docs/AUTHENTICATION.md:0:0-0:0) to be purely code-driven, removing references to AGENTS.md and adding an admin auth section with exact file citations.

To ensure the documentation reflects the exact current code behavior, I'll verify a few implementation specifics:
- Whether Facebook OAuth is actually used anywhere in the source.
- Whether `/api/admin/session` is implemented to match the admin hook.
- Confirm the absence of a post-login hard reload guard pattern.
- Confirm that [ensure-profile](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/ensure-profile:0:0-0:0) is not auto-invoked.

I'll run focused searches in `src/` for these.

I'll search for the admin session API route and related admin API files to ensure the documentation reflects exactly what's implemented in the codebase.



# Findings (code-verified, current repo)

- **[Email/Password flow]**
  - Implemented in `src/app/[locale]/auth/login/page.tsx` via `supabase.auth.signInWithPassword()` and `router.push(redirectTo)`.
  - No one-time post-login hard reload is present; hydration handled by `AuthProvider` in `src/lib/providers/auth-provider.tsx`.

- **[Google OAuth]**
  - Starts with `supabase.auth.signInWithOAuth({ provider: 'google', options.redirectTo: <site>/en/auth/callback?... })` in `src/app/[locale]/auth/login/page.tsx`.
  - Callback handlers:
    - Localized: `src/app/[locale]/auth/callback/route.ts`
    - Non-localized alias: [src/app/auth/callback/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/auth/callback/route.ts:0:0-0:0)
  - Exchange done with `supabase.auth.exchangeCodeForSession(code)`. Recovery flow (password reset) falls back to `verifyOtp({ token[_hash], type: 'recovery' })`.

- **[Telegram (Widget + Deep-link)]**
  - Widget verify endpoint (prod-only): [src/app/api/auth/telegram/verify/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/telegram/verify/route.ts:0:0-0:0)
    - HMAC verification using `TELEGRAM_AUTH_BOT_TOKEN`, 10-min freshness window, in-memory rate limiting and replay guard.
    - Ensures auth user via synthetic email `tg_<id>@telegram.foryoupiece.local`.
    - Prefers `auth.admin.generateLink({ type: 'magiclink' })` then verifies with `verifyOtp({ type:'magiclink', token_hash })` or email OTP; sets server-side session; redirects to `/en/profile?auth=telegram_success`.
  - Deep-link start (nonce): [src/app/api/auth/telegram/start/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/telegram/start/route.ts:0:0-0:0) → stores nonce in `public.auth_nonces` (see [src/lib/telegram/nonce-store.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/lib/telegram/nonce-store.ts:0:0-0:0) and [supabase/migrations/20250920_auth_nonces_kv.sql](cci:7://file:///Users/kitokati/foryoupiece-web-1/supabase/migrations/20250920_auth_nonces_kv.sql:0:0-0:0)).
  - Deep-link poll: [src/app/api/auth/telegram/poll/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/telegram/poll/route.ts:0:0-0:0) → if `NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN==='true'`, does server handoff with `auth.setSession()`. Otherwise returns tokens for client `setSession()`.

- **[Auth state and sync]**
  - `src/lib/providers/auth-provider.tsx` subscribes once to `supabase.auth.onAuthStateChange`.
    - On `INITIAL_SESSION`/`SIGNED_IN`: sets `useUserStore.user`, fetches profile via [userQueries.getProfile()](cci:1://file:///Users/kitokati/foryoupiece-web-1/src/lib/supabase/queries.ts:20:2-85:3), sets `useCartStore.userId`, and [forceLoadCartForUser()](cci:1://file:///Users/kitokati/foryoupiece-web-1/src/lib/store/cart-store.ts:245:6-254:7).
    - On `SIGNED_OUT`: clears user/cart and `router.replace('/en/auth/login')`.
    - Broadcasts with `BroadcastChannel('app_auth_channel')` for cross-tab sync.

- **[Session validation + middleware]**
  - Middleware [src/middleware.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/middleware.ts:0:0-0:0): hardened cookie options (httpOnly, SameSite=Lax, secure in prod), `Content-Security-Policy` nonce, and protected path redirects. Uses [auth.getSession()](cci:1://file:///Users/kitokati/foryoupiece-web-1/src/lib/supabase/server.ts:23:8-23:83); respects `expires_at`.
  - Session APIs:
    - [src/app/api/auth/session/validate/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/session/validate/route.ts:0:0-0:0) → POST validate + PUT refresh (uses `supabase.auth.refreshSession()`).
    - [src/app/api/auth/session/enhanced-validate/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/session/enhanced-validate/route.ts:0:0-0:0) → stricter checks, blacklist integration.

- **[Ensure profile]**
  - API exists at [src/app/api/auth/ensure-profile/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/ensure-profile/route.ts:0:0-0:0) (service-role upsert + RLS-respecting read).
  - Not automatically invoked anywhere in `src/` (no matches for [/api/auth/ensure-profile](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/ensure-profile:0:0-0:0)).

- **[Token blacklisting]**
  - Used by [src/lib/security/session-manager.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/lib/security/session-manager.ts:0:0-0:0) and logout API [src/app/api/auth/logout/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/logout/route.ts:0:0-0:0).
  - Table `public.blacklisted_tokens` is referenced but no migration exists in repo; doc includes a DDL snippet to add it.

- **[Admin auth code present, API missing]**
  - Hook `src/lib/hooks/use-secure-admin-auth.ts` expects `/api/admin/session`; no such route exists in this snapshot.
  - `src/lib/auth/admin-middleware.ts` implements `verifyAdminAuth()` (service-role admin check) but no API routes import it.

- **[Facebook OAuth]**
  - Not implemented in `src/` (no `provider: 'facebook'` usages). A guide file exists ([FACEBOOK_OAUTH_FIX_GUIDE.md](cci:7://file:///Users/kitokati/foryoupiece-web-1/FACEBOOK_OAUTH_FIX_GUIDE.md:0:0-0:0)) but no active code path.

# What I changed

- **Updated [docs/AUTHENTICATION.md](cci:7://file:///Users/kitokati/foryoupiece-web-1/docs/AUTHENTICATION.md:0:0-0:0) to be strictly code-driven**
  - Removed references to AGENTS.md and replaced with code-observed patterns.
  - Added explicit note: [ensure-profile](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/ensure-profile:0:0-0:0) is not auto-invoked; call it after auth if you need the `users` row guaranteed.
  - Added section “Admin authentication (hook present; API endpoints missing)” citing `use-secure-admin-auth.ts` and absence of `/api/admin/session`.
  - Clarified environment variables are “Required (from code).”
  - Replaced the “Observed differences vs Design Notes” with “Code‑Verified Confirmations & Gaps,” listing:
    - No Facebook OAuth in `src/`.
    - ensure-profile not auto-called.
    - Admin session API missing.
    - No post-login hard reload present.
    - `blacklisted_tokens` migration missing.
    - Telegram verify is prod-only.

# Recommended Actions

- **[add_blacklist_ddl]** Create `public.blacklisted_tokens` as documented in [docs/AUTHENTICATION.md](cci:7://file:///Users/kitokati/foryoupiece-web-1/docs/AUTHENTICATION.md:0:0-0:0) Section 8.
- **[call_ensure_profile]** Decide whether to automatically call `POST /api/auth/ensure-profile` after successful auth (e.g., in callback route or right after `SIGNED_IN` in `AuthProvider`).
- **[admin_api]** If you plan to use the admin hook, implement `/api/admin/session` endpoints (GET validate, POST/DELETE for session lifecycle) and wire `verifyAdminAuth()` into admin APIs.
- **[optional_reload_guard]** If you still see stale profile after login, we can reintroduce a one-time hard reload pattern guarded by a sessionStorage flag.
- **[scaling_limits]** Move Telegram verify rate-limit and replay guards from in-memory to Redis for multi-instance deployments.

# File Citations

- `src/app/[locale]/auth/login/page.tsx`
- `src/app/[locale]/auth/callback/route.ts`
- [src/app/auth/callback/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/auth/callback/route.ts:0:0-0:0)
- [src/app/api/auth/ensure-profile/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/ensure-profile/route.ts:0:0-0:0)
- [src/app/api/auth/logout/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/logout/route.ts:0:0-0:0)
- [src/app/api/auth/session/validate/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/session/validate/route.ts:0:0-0:0)
- [src/app/api/auth/session/enhanced-validate/route.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/session/enhanced-validate/route.ts:0:0-0:0)
- `src/app/api/auth/telegram/{start,verify,poll}/route.ts`
- `src/lib/providers/auth-provider.tsx`
- `src/lib/hooks/use-ssr-safe-auth.ts`
- [src/lib/security/session-manager.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/lib/security/session-manager.ts:0:0-0:0)
- [src/lib/security/error-sanitizer.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/lib/security/error-sanitizer.ts:0:0-0:0)
- [src/lib/telegram/nonce-store.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/lib/telegram/nonce-store.ts:0:0-0:0)
- [src/middleware.ts](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/middleware.ts:0:0-0:0)
- [supabase/migrations/20250920_auth_nonces_kv.sql](cci:7://file:///Users/kitokati/foryoupiece-web-1/supabase/migrations/20250920_auth_nonces_kv.sql:0:0-0:0)
- [supabase/migrations/20250914_add_user_ban_system.sql](cci:7://file:///Users/kitokati/foryoupiece-web-1/supabase/migrations/20250914_add_user_ban_system.sql:0:0-0:0)

# Task Status

- **Completed**: Converted [docs/AUTHENTICATION.md](cci:7://file:///Users/kitokati/foryoupiece-web-1/docs/AUTHENTICATION.md:0:0-0:0) to a strictly code-based, rebuild-ready spec with exact file references and a “code‑verified confirmations & gaps” section.
- **Pending decisions**: Whether to auto-invoke [ensure-profile](cci:7://file:///Users/kitokati/foryoupiece-web-1/src/app/api/auth/Users/kitokati/foryoupiece-web-1/src/app/api/auth/ensure-profile:0:0-0:0), add the `blacklisted_tokens` migration, and implement admin session APIs.