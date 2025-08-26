# ForYouPiece E-commerce Overview
- ForYouPiece is an English-only e-commerce application selling premium Japanese products to Cambodia with future worldwide expansion plans.
- User prefers Amazon-inspired layout with modern, minimalistic, product-focused design using black/white color scheme, clean typography, and larger product images.
- Navigation structure: 'Trending Now', 'Deals and Discounts', 'Recently Added', 'Recommended for You', 'Categories' with smooth scroll-to-section behavior.
- Show stock warnings only for critically low inventory (1 left, limited stock for 2), use 'Fast delivery' instead of 'In Stock' for Cambodian commerce compliance.

# UI/UX Requirements
- Mobile-first responsive design with minimum 2 products per row on mobile, proper touch targets (44px minimum), and testing across multiple viewports (320px, 375px, 414px, 768px, 1024+).
- Enterprise-level UI/UX framework with responsive grid, reusable component library, WCAG accessibility standards, dynamic theming, and optimized form UX with inline validation.
- Account dropdown should appear below header (not overlay); search input fields positioned in upper portion of viewport for better mobile accessibility.
- User prefers Tailwind CSS for styling with !important modifiers (!pl-12, !pr-12) to override base Input component's px-3 class where needed.
- Mobile cart UI standard: On mobile (320–414px) checkboxes should use visual size h-3 w-3 wrapped in a container to preserve accessibility.
- For mobile cart UI (300px-768px viewports), prioritize compact sizing over strict accessibility touch targets to create fast, efficient, mobile-native experience with reduced visual clutter and streamlined checkout flow.

# Authentication and Security
- Multiple authentication methods: Google OAuth, Facebook OAuth, and Telegram Login Widget with Supabase integration.
- Secure admin system with obscured routes (/fyponly/admin), role-based access control, and separation between admin and regular user flows.
- Implement server-side session validation using getUser() instead of getSession(), add custom storage validation, implement periodic session checks.
- Admin system requires httpOnly cookies for token storage, automatic session timeout, and token rotation.
- Gate Supabase client console logs behind NEXT_PUBLIC_DEBUG_SUPABASE and only show them in development.
- ForYouPiece production admin failures are primarily caused by missing SUPABASE_SERVICE_ROLE_KEY environment variables, schema drift (missing log_admin_action RPC and RLS policies), super_admin email/IP restrictions, and stricter session aging in production vs development environments.

# BoxHero API Integration
- Manual sync system with BoxHero API for inventory management, accessed via /en/fyponly-admin URL.
- Sync-based architecture where API calls only happen during manual sync operations, with Supabase as single source of truth for frontend data.
- BoxHero API supports proper pagination with cursor/has_more parameters requiring proper while loop iteration until has_more = false.
- BoxHero sync includes trending tags that should automatically populate the trending section (default 10 items, hard ceiling 30 total).

# Cart and Checkout
- $1.50 fixed shipping fee with free shipping for 4+ items, no tax calculations.
- Unauthenticated users can browse/cart without login (only required at checkout).
- Show crossed-out original prices with discount amounts and percentages for sale items, display total savings in cart summary.
- Simplified address fields (only Address Line 1 required, Address Line 2 optional), ABA Bank Name field with 'Taravatey Than' placeholder.
- Manual QR code payment processing where orders are placed with 'On Hold' status, users see thank you page with payment instructions.

# Loyalty Points System
- 10 points per $1 spent (1% cashback equivalent), 1000 points = $1 value for redemption.
- Rank tiers: Silver (5k+), Gold (15k+), Platinum (35k+), Diamond (50k+ points) with annual rank reset on January 1st.
- Redemption requires minimum 500 points in increments of 10 points, with smart suggestions and validation rules for checkout.
- Points are deducted immediately on order placement (not admin confirmation), with automatic refund on order cancellation.
- Automatic reward distribution on tier upgrades with unique coupon code generation and user-specific reward isolation.

# Telegram Bots and Notifications
- Two separate Telegram bots: @Authenticationfypbot (8066090295) for OAuth and @notificationfypbot for notifications.
- Order notifications sent to specific threads (thread ID 2) within groups: -1002251987881 (notifications).
- Telegram confirmation messages should use detailed format with 'PAID✅✅' status, complete customer info, order summary, and items list, sent to group -1002667614926 thread 3.
- System automatically completes orders in admin panel when confirmed via Telegram buttons.
- For customer notifications: use English-only, Resend is already connected to Supabase, test Telegram to @Creatorww123 and send dev emails to akito12350@gmail.com, and ensure idempotency with email-only fallback when no telegram_id.
- User prefers implementing automatic email notifications triggered by centralized order status changes rather than integration-specific logic, ensuring notifications work universally regardless of trigger source (admin panel, Telegram, API calls, etc.).

# Admin Features
- Streamlined admin order management with single-click completion replacing 3-step process.
- Admin panel displays paginated data (40 items per page) with server-side pagination, URL state preservation, and search/filter functionality.
- Super_admin-only product deletion with soft deletion (is_deleted, deleted_at, deleted_by, deleted_reason fields), CSRF protection, and comprehensive audit logging.
- Admin panel coupon management system requires full CRUD functionality.
- Redesign Customer Communication admin panel to a chat-style interface with a left user list (search, pagination, unread badges) and right chat (incoming left-green, outgoing right-blue, timestamps, delivery status, real-time updates), keep direction badges, and require comprehensive Playwright MCP testing.
- ForYouPiece admin communication panel should have real-time message updates as primary option or manual reload button as fallback, maintaining current message formatting and preserving all existing functionality without breaking current features.

# Testing and Deployment Requirements
- Comprehensive end-to-end testing for e-commerce integrations, authentication flows, and responsive design across viewports (320px through 1920px).
- For authentication system testing, always test with browser dev tools open to monitor console errors and network requests.
- For critical production issues, conduct thorough end-to-end testing with real data flows, verify database queries and data transformations at each step.
- For testing, route customer emails to akito12350@gmail.com even without using DEV_EMAIL_OVERRIDE (they configured Resend/Vercel env but prefer production-like sends to this address).
- For customer notification system testing, use two-phase approach: Phase 1 local testing (localhost:3001) then Phase 2 production testing, with RESEND_OVERRIDE_ALL_TO=akito12350@gmail.com and DEV_TELEGRAM_OVERRIDE_CHAT_ID for @Creatorww123, validating email routing, Telegram DMs, order status updates, console logs, email_logs table entries, and idempotency.
- During testing, route all customer notifications to test addresses by setting RESEND_OVERRIDE_ALL_TO=akito12350@gmail.com and DEV_TELEGRAM_OVERRIDE_CHAT_ID (for @Creatorww123), keeping admin Telegram notifications unchanged.
- ForYouPiece production deployments: remove testing environment variables (ENABLE_TEST_APIS, RESEND_OVERRIDE_ALL_TO, DEV_TELEGRAM_OVERRIDE_CHAT_ID) and test endpoints before deployment, then perform comprehensive end-to-end testing with real customer notification flows, email delivery, and Telegram notifications to validate production readiness.
- ForYouPiece production testing: verify real credentials (RESEND_API_KEY, TELEGRAM_BOT_TOKEN), test end-to-end customer notifications with real emails, confirm admin/customer channel separation, validate idempotency system, and ensure no development overrides remain active in production environment.
- ForYouPiece production deployment verification requires 6-step end-to-end testing: Playwright MCP order flow test, Supabase email_logs database verification, Resend dashboard message confirmation, Vercel function logs review, email receipt validation, and detailed results reporting with screenshots/logs.
- ForYouPiece email system testing requires comprehensive end-to-end verification: order placement → customer notification service trigger → Supabase Edge Function call → Resend API delivery → database logging → actual email receipt confirmation, with debugging at each failure point.
- For cancellation flows, testing should be performed via the website admin panel (cancellation happens in admin), and order creation is already working.