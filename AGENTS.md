# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ForYouPiece is a Next.js 15 e-commerce platform with Supabase backend, focusing on Japanese products shipped to Cambodia. The application features multi-language support (English/Japanese), real-time inventory sync with BoxHero API, and Telegram bot integration for order management.

## Essential Commands

```bash
# Development
npm run dev              # Start development server
npm run dev:fresh        # Clear cache and start fresh dev server
npm run build           # Build for production
npm run lint            # Run ESLint

# Cache Management
npm run clear-cache     # Clear Next.js cache

# Database
npx supabase migration new <name>  # Create new migration
npx supabase db push               # Apply migrations to database

# Testing (Playwright)
npx playwright test                           # Run all tests
npx playwright test <file>                    # Run specific test file
npx playwright test --debug                   # Debug mode
npx playwright test --ui                      # Interactive UI mode
```

## Architecture Overview

### Core Stack
- **Frontend**: Next.js 15 App Router with TypeScript
- **Database**: Supabase (PostgreSQL with RLS policies)
- **Authentication**: Supabase Auth with Google/Facebook OAuth + Telegram Login Widget
- **State Management**: Zustand with SSR-safe wrappers
- **Styling**: Tailwind CSS with shadcn/ui components
- **Internationalization**: next-intl (English/Japanese)

### Critical Architectural Patterns

#### 1. Data Flow Architecture
```
BoxHero API → Manual Sync → Supabase DB → Service Role Client → API Routes → Frontend
```
- Supabase is the single source of truth for frontend
- BoxHero sync happens only via admin manual trigger
- Service role client bypasses RLS for admin operations

#### 2. Authentication Flow
- Regular users: Google/Facebook OAuth or Telegram Login
- Admin users: Separate auth at `/fyponly-admin` with MFA requirement
- Cross-tab session synchronization via BroadcastChannel API
- Session validation uses `getUser()` not `getSession()` for security

#### 4. API Route Security Pattern
All admin routes follow this pattern:
```typescript
1. Rate limiting check
2. Admin authentication verification
3. Service role client for database operations
4. Comprehensive error handling with sanitization
```

## Key Directories & Their Purposes

- `/src/app/[locale]/` - Internationalized pages with App Router
- `/src/app/api/` - API routes (admin routes have rate limiting)
- `/src/lib/supabase/` - Database clients and queries
- `/src/lib/services/` - Business logic services
- `/src/lib/telegram/` - Telegram bot integration
- `/src/lib/store/` - Zustand stores with SSR safety
- `/supabase/migrations/` - Database migrations (numbered sequentially)

## Critical Implementation Details

### BoxHero Integration
- API calls are rate-limited (200ms between requests)
- Pagination uses cursor-based approach with `has_more` flag
- Sync operations update `boxhero_last_sync_at` timestamp
- Manual sync only via admin dashboard at `/fyponly-admin/boxhero-sync`

### Telegram Bots Configuration
- **Authentication Bot**: @Authenticationfypbot (ID: 8066090295)
- **Notification Bot**: @notificationfypbot
- Order notifications go to group `-1002667614926` thread `3`
- Webhooks require signature verification for security

### Points System Logic
- New users: 1000 welcome points
- Earning: 10 points per $1 spent
- Redemption: Minimum 500 points, increments of 10
- Rank tiers reset annually on January 1st
- Points deducted on order placement, refunded on cancellation

### Mobile-First Requirements
- Minimum 2 products per row on mobile (320px+)
- Touch targets minimum 44px
- Test viewports: 320px, 375px, 414px, 768px, 1024px+
- Cart/checkout optimized for minimal scrolling

### Performance Considerations
- Homepage data combined into single API endpoint
- Product queries use database indexes (see migration 022)
- In-memory caching for user profiles (5 min TTL)
- Request deduplication to prevent duplicate API calls

### Known Issues & Workarounds
1. **Console Logging**: Excessive logging in production - needs cleanup
2. **Memory Leaks**: Uncleared intervals in performance monitor and cache
3. **Session Racing**: Cross-tab sync can cause duplicate API calls
4. **Bundle Size**: Dev dependencies included in production build

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# BoxHero
BOXHERO_API_TOKEN

# Telegram
TELEGRAM_BOT_TOKEN
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
NEXT_PUBLIC_TELEGRAM_BOT_ID

# Site
NEXT_PUBLIC_SITE_URL
```

## Database Migration Pattern

Migrations are numbered sequentially and should follow this pattern:
```sql
-- Migration number and descriptive name
-- 027_feature_name.sql

-- Add new tables/columns
CREATE TABLE IF NOT EXISTS ...

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS ...

-- Update RLS policies
CREATE POLICY ...

-- Add comments for documentation
COMMENT ON TABLE ... IS '...';
```

## Testing Approach

1. **Authentication Testing**: Always test with dev tools open, check for loops
2. **Admin Features**: Test save → frontend reflection → database verification
3. **Responsive Design**: Test all viewports systematically
4. **Telegram Integration**: Verify webhook signatures and thread IDs
5. **Points System**: Test earning, redemption, and rank calculations

## Admin Panel Access

- URL: `/en/fyponly-admin` (obscured route)
- Requires admin role in Supabase
- MFA required for first login and periodically
- Rate limited to prevent brute force

## Deployment Notes

- Production uses Vercel with automatic deployments
- Environment variables set in Vercel dashboard
- Supabase migrations must be applied before deployment
- Clear Redis cache after major updates (when implemented)

## General INformaiton
# ForYouPiece E-commerce Overview
- ForYouPiece is an English-only e-commerce application selling premium Japanese products to Cambodia with future worldwide expansion plans.
- User prefers Amazon-inspired layout with modern, minimalistic design using black/white color scheme, clean typography, and larger product images.
- Navigation structure: 'Trending Now', 'Deals and Discounts', 'Recently Added', 'Recommended for You', 'Categories' with smooth scroll-to-section behavior.
- Show stock warnings only for critically low inventory (1 left, limited stock for 2), use 'Fast delivery' instead of 'In Stock' for Cambodian commerce compliance.

# UI/UX Requirements
- Mobile-first responsive design with minimum 2 products per row on mobile, proper touch targets (44px minimum), and testing across multiple viewports.
- User prefers Tailwind CSS with !important modifiers (!pl-12, !pr-12) to override base component classes where needed.
- For mobile cart UI (300px-768px), prioritize compact sizing over strict accessibility touch targets for a streamlined checkout flow.
- On checkout page, 'Order Notes' card must appear above 'Shipping Address' card with minimal vertical spacing on mobile.
- For checkout mobile, order sections as: Payment Method → Order Notes → Shipping Address → Points Redemption with compressed layout.
- User prefers concise, cleanly spaced responses optimized for mobile readability.
- When testing mobile UI (e.g., filters), prioritize user visibility over technical clickability: take screenshots at 300/375/414/600/700 widths, ensure sidebar is hidden by default with a clearly visible toggle, overlays content with correct z-index, and validate the full filter workflow visually.
- On mobile, the filter sidebar modal should automatically close after any filter is applied (category, price preset/custom apply, brand) to immediately show results.

# Authentication and Security
- Multiple authentication methods: Google OAuth, MAIL OAuth, and Telegram Login Widget with Supabase integration.
- Secure admin system with obscured routes (/fyponly/admin), role-based access control, and separation between admin and regular user flows.
- Implement server-side session validation using getUser(), add custom storage validation, implement periodic session checks.
- Admin system requires httpOnly cookies for token storage, automatic session timeout, and token rotation.
- Gate Supabase client console logs behind NEXT_PUBLIC_DEBUG_SUPABASE and only show them in development.


## Authentication Implementation (Current) — Read First

- One‑time AuthProvider init with global guard `__AUTH_PROVIDER_INIT_DONE` to prevent React StrictMode/HMR double initialization and cleanup/re‑init races. Runs once per tab; cleanup is harmless.
- On INITIAL_SESSION/SIGNED_IN: set `user` + `userId` immediately and unblock UI (`setStoreLoading(false); setHydrated(true)`); profile and cart load in parallel afterwards to avoid perceived hangs.
- Login page behavior: after email/password success OR when `onAuthStateChange` emits `SIGNED_IN`, trigger a programmatic hard reload using `window.location.replace(redirectTo + '?r=' + Date.now())` guarded by `__postLoginReloadDone`. This guarantees fresh profile/points/tier/preferences with no manual Ctrl+F5.
- Account dropdowns (all variants) are gated by a real Supabase session: call `supabase.auth.getSession()` and render authenticated menu only when `session.access_token` exists; otherwise show a simple "Sign In" link.
- Middleware respects Supabase cookie deletion semantics (preserves `maxAge: 0`/`expires`) so logout reliably clears cookies.
- Cross‑tab sign‑out guard: `signOutInProgress` (local + window flag) prevents restoration during logout, cleared on `SIGNED_IN` if needed.

Do/Don’t
- DO keep the post‑login hard reload – it fixes incomplete data (e.g., "Telegram User" placeholder) and ensures full hydration.
- DO avoid reintroducing store‑only checks for auth UI; always gate with `getSession()`.
- DO NOT add dependencies to the AuthProvider init effect; it must run once. Changes belong in auth state handler, not init.
- DO NOT override auth cookies’ deletion with default expiries in middleware.

Troubleshooting checklist
1) Seeing placeholders after login? Confirm the hard reload still runs; look for `__postLoginReloadDone` and a cache‑busting `?r=` param.
2) Double init logs? Ensure `__AUTH_PROVIDER_INIT_DONE` remains at module scope and the init effect has `[]` deps.
3) Dropdown shows while logged out? Verify `getSession()` check and that `hasSession === false` renders the Sign In UI.



# BoxHero API Integration
- Manual sync system with BoxHero API for inventory management, accessed via /en/fyponly-admin URL.
- Sync-based architecture where API calls only happen during manual sync operations, with Supabase as single source of truth.
- BoxHero API supports proper pagination with cursor/has_more parameters requiring proper while loop iteration.
- BoxHero sync includes trending tags that should automatically populate the trending section.
- After BoxHero sync, the admin dashboard and product pages must reflect inventory updates immediately without manual refresh.
- BoxHero sync must not import or set product images; product images are to be uploaded manually via the admin interface only, preserving existing products’ images.

# Cart and Checkout
- $1.50 fixed shipping fee with free shipping for 4+ items, no tax calculations.
- Unauthenticated users can browse/cart without login (only required at checkout).
- Show crossed-out original prices with discount amounts and percentages for sale items, display total savings in cart summary.
- Simplified address fields with ABA Bank Name field with 'Taravatey Than' placeholder.
- Manual QR code payment processing where orders are placed with 'On Hold' status, users see thank you page with payment instructions.

# Loyalty Points System
- 10 points per $1 spent (1% cashback equivalent), 1000 points = $1 value for redemption.
- Rank tiers: Silver (5k+), Gold (15k+), Platinum (35k+), Diamond (50k+ points) with annual rank reset.
- Redemption requires minimum 500 points in increments of 10 points, with smart suggestions and validation rules.
- Points are deducted immediately on order placement, with automatic refund on order cancellation.

# Telegram Bots and Notifications
- Two separate Telegram bots: @Authenticationfypbot for OAuth and @notificationfypbot for notifications.
- Order notifications sent to specific threads within groups with detailed format including order status and summary.
- System automatically completes orders in admin panel when confirmed via Telegram buttons.
- For customer notifications: use English-only, test Telegram to @Creatorww123 and send dev emails to akito12350@gmail.com.
- Implement automatic email notifications triggered by centralized order status changes rather than integration-specific logic.
- Use https://t.me/m/zDsQTcg4MDJl as the customer-facing Telegram support link; do not modify admin/auth bots or internal Telegram integrations.
- Implement a staff-only Telegram helper bot restricted to two specific group threads (no individual chats), using OpenRouter Sonnet 4 with catalog API-based retrieval, 10-turn/5-minute per-thread memory, ≤100k token context, order confirmation templating, disambiguation and top-3 recommendations, and strict security (env vars only, no secret logging).
- Telegram Staff Helper Bot memory isolation uses Admin thread ID 1519 and Team thread ID 1521, with a 10-message limit and 5-minute TTL.
- Telegram Staff Helper Bot must proactively suggest products using live catalog data with fuzzy matching, provide top-3 suggestions including stock and price, use tentative phrasing, and fall back to category-based recommendations instead of asking clarifying questions.
- Telegram Staff Helper Bot must use 10-message/5-minute memory, call OpenRouter AI for complex/non-product queries and order confirmations, and reply to greetings with: “Hi! What would you like to know?”.

# Admin Features
- Streamlined admin order management with single-click completion replacing 3-step process.
- Admin panel displays paginated data (40 items per page) with server-side pagination, URL state preservation, and search/filter functionality.
- Super_admin-only product deletion with soft deletion and comprehensive audit logging.
- Redesign Customer Communication admin panel to a chat-style interface with user list and chat view, with Recently Ordered Customer badge immediately visible.
- Admin communication panel should have real-time message updates as primary option or manual reload button as fallback.

# Trending Products and Deals
- Trending products must use auto-random instead of manual positions (treat position 0 as auto-random).
- Display in-stock items first with random order within each stock group, rotating every 3 days.
- Ensure compatibility with both admin edits and BoxHero sync.
- Deals recommendations must include products with compare_at_price > price, points_rate > 1.0, and any promotional markings, casting a wider net rather than filtering narrowly.

# Testing and Deployment
- Comprehensive end-to-end testing across viewports (320px through 1920px) with browser dev tools monitoring.
- For testing, route customer emails to akito12350@gmail.com and use DEV_TELEGRAM_OVERRIDE_CHAT_ID for @Creatorww123.
- ForYouPiece production deployments: remove testing environment variables before deployment and perform comprehensive testing.
- Email system testing requires end-to-end verification including order placement, queue processing, delivery confirmation, and database logging.
- TELEGRAM TESTING IS ONLY CAN BE DONE IN PRODUCTION.

# API and Caching Strategies
- For APIs, prefer DB-level filtering with cursor-based pagination, return narrow projections.
- Use Next.js caching with revalidate=300 and tag-based revalidation (e.g., revalidateTag('products')) invalidated after BoxHero sync.
- Cache personalized results by stable user segment when possible.

# Coupon Creation
- Enhance coupon creation with toggleable user targeting (rank tiers Silver/Gold/Platinum/Diamond, recently signed up ≤2 weeks, top purchasers by threshold/top N, recently purchased within timeframe), show eligible users in admin (40 per page with totals and details), validate eligibility at redemption, preserve backward compatibility, and test only with akito12350@gmail.com or designated test users.

## Do‑Not‑Break Reference: Authentication System & Telegram Integration (Authoritative Summary)

This section documents the exact behaviors relied on across the app. Do not modify these without an explicit plan, feature flag, and production soak.


### Telegram Integration (Current)
1) Two‑bot architecture
- Authentication bot: @Authenticationfypbot (ID: 8066090295) — used for OAuth/login.
- Notification bot: @notificationfypbot — used for order updates.

2) Order notification routing
- Target: group `-1002667614926`, thread `3`.
- Format: detailed order summary; admin actions are handled from Telegram and reflected in the admin panel.

3) Telegram authentication flow (high‑level)
- Widget verification on client → server verifies Telegram payload → upsert Supabase auth user and users profile row → generate magic link and verify (prefer `token_hash`) → Supabase session is established → client lands on profile and triggers the post‑login hard reload. All branches (including duplicate user) converge to the same success redirect format.

4) Webhook security
- All Telegram webhooks must perform signature verification and input sanitization before processing.

5) Staff Helper Bot memory isolation
- Threads: Admin ID 1519, Team ID 1521.
- Memory policy: 10 messages per thread, 5‑minute TTL; no individual chats; strict security via env vars (no secret logging).

6) Testing constraints
- Telegram end‑to‑end testing can only be performed in production. Use DEV overrides only where explicitly documented; otherwise avoid modifying bot identities and threads.

Operational Guidance
- Prefer server‑side session establishment for Telegram (verify → set session → clean redirect). If experimenting with new flows (e.g., session bridge), gate behind `NEXT_PUBLIC_AUTH_USE_SERVER_TELEGRAM_LOGIN` (or a dedicated flag) with telemetry and rate limiting, and keep the existing AuthProvider/monitor in place until proven stable.
- Always add rate limiting and anti‑replay (nonce single‑use) to verification endpoints.
- Maintain Referrer‑Policy and never place auth tokens in URLs.
