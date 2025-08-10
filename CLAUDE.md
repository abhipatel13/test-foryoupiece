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

#### 3. State Management Pattern
```typescript
// All stores use SSR-safe wrappers to prevent hydration mismatches
useSSRSafeUserStore()  // User authentication state
useSSRSafeCartStore()  // Shopping cart with multi-tab sync
```

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