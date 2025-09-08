



















































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

# Authentication and Security
- Multiple authentication methods: Google OAuth, Facebook OAuth, and Telegram Login Widget with Supabase integration.
- Secure admin system with obscured routes (/fyponly/admin), role-based access control, and separation between admin and regular user flows.
- Implement server-side session validation using getUser(), add custom storage validation, implement periodic session checks.
- Admin system requires httpOnly cookies for token storage, automatic session timeout, and token rotation.
- Gate Supabase client console logs behind NEXT_PUBLIC_DEBUG_SUPABASE and only show them in development.

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