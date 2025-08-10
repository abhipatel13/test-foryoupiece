# ForYouPiece E-commerce Application Requirements
- Foryoupiece is an English-only e-commerce application with a premium Japanese products business model delivering from Japan to Cambodia with future worldwide expansion.
- User prefers Amazon-inspired layout with modern, minimalistic, product-focused design using black/white color scheme, clean typography, and larger product images.
- Requires mobile-first responsive design with minimum 2 products per row on mobile, proper touch targets (44px minimum), and testing across multiple viewports (320px, 375px, 414px, 768px, 1024+).
- ForYouPiece requires minimum 2-column layout on mobile devices (300px-,320px, 375px, 414px viewports) with responsive design patterns, duplicate prevention logic for user actions, and comprehensive cross-viewport testing for all features.
- Navigation structure: 'Trending Now', 'Deals and Discounts', 'Recently Added', 'Recommended for You', 'Categories' with smooth scroll-to-section behavior.
- Show stock warnings only for critically low inventory (1 left, limited stock for 2), use 'Fast delivery' instead of 'In Stock' for Cambodian commerce compliance.
- 'Recently Added' section should display genuinely new products based on creation date/sync timestamp from BoxHero API.
- User prefers mobile-first functionality patterns and wants desktop search dropdown to work like the mobile version which 'works like magic'.
- ForYouPiece requires Amazon-like multi-tab session management where authentication state is shared across all tabs, new tabs show authenticated state immediately, and no performance degradation occurs with multiple tabs open.
- ForYouPiece requires robust cart state synchronization across browser sessions with proper isolation between authenticated/guest users, SSR-safe Zustand implementation, and complete cart cleanup on logout to prevent cross-session data leakage.

# Authentication and Security
- Implements multiple authentication methods: Google OAuth, Facebook OAuth, and Telegram Login Widget with Supabase integration.
- Secure admin system with obscured routes (/fyponly/admin), strict role-based access control, and separation between admin and regular user flows.
- Supabase native MFA with email-based verification for admin authentication, requiring 2FA for first-time logins and periodically (7-30 days).
- Modern browsers (Chrome 115+, Firefox 117+, Safari 16.4+) block third-party cookies affecting Telegram Login Widget, requiring fallback solutions.
- Authentication form input padding issues fixed by adding !important modifier (!pl-12, !pr-12) to override base Input component's px-3 class.
- For cross-browser authentication issues with Supabase, implement server-side session validation using getUser() instead of getSession(), add custom storage validation, implement periodic session checks, clear all localStorage/sessionStorage on sign-out, and use version-controlled Zustand stores with migration to handle stale data across browsers.
- ForYouPiece requires comprehensive security audit procedures including Git history cleanup for credential exposure, test file security scanning for hardcoded credentials, secure .env.local.example templates, and end-to-end testing validation for all authentication flows and API integrations.
- ForYouPiece admin system requires httpOnly cookies for token storage instead of localStorage, automatic session timeout, token rotation, and preservation of all existing admin functionality during security fixes.

# BoxHero API Integration
- Manual sync system with BoxHero API  for inventory management, accessed via /en/fyponly-admin URL.
- Sync-based architecture where API calls only happen during manual sync operations, with Supabase as single source of truth for frontend data.
- Enhanced BoxHero sync with comprehensive reporting, real-time data refresh in admin dashboard, activity logs, and proper cache invalidation.
- BoxHero API supports proper pagination with cursor/has_more parameters requiring proper while loop iteration until has_more = false.

# Cart and Checkout
- $1.50 fixed shipping fee with free shipping for 4+ items, no tax calculations.
- Unauthenticated users can browse/cart without login (only required at checkout).
- Show crossed-out original prices with discount amounts and percentages for sale items, display total savings in cart summary.
- Simplified address fields (only Address Line 1 required, Address Line 2 optional), ABA Bank Name field with 'Taravatey Than' placeholder.
- Manual QR code payment processing where orders are placed with 'On Hold' status, users see thank you page with payment instructions.
- Cart page mobile optimization requires button sizing for 44px minimum touch targets, compact layout to minimize scrolling to checkout, streamlined UI to reduce information overload on small screens, and fully functional points redemption system with mobile-optimized interface.

# Loyalty Points System
- New user signup points allocation increased from 100 to 1000 points.
- 10 points per $1 spent (1% cashback equivalent), 1000 points = $1 value for redemption.
- Rank tiers: Silver (5k+), Gold (15k+), Platinum (35k+), Diamond (50k+ points) with annual rank reset on January 1st.
- Redemption requires minimum 500 points in increments of 10 points, with smart suggestions and validation rules for checkout.
- Points are deducted immediately on order placement (not admin confirmation), with automatic refund on order cancellation.
- ForYouPiece loyalty tier system requires automatic reward distribution on tier upgrades (Silver 5k+, Gold 15k+, Platinum 35k+, Diamond 50k+), unique coupon code generation, user-specific reward isolation, account page 'Rewards & Coupons' section with tier progress indicators, and comprehensive end-to-end testing validation.

# Telegram Bots and Notifications
- Two separate Telegram bots: @Authenticationfypbot (8066090295) for OAuth and @notificationfypbot  for notifications.
- Order notifications sent to specific threads (thread ID 2) within groups: -1002251987881 (notifications).
- Telegram confirmation messages should use detailed format with 'PAID✅✅' status, complete customer info, order summary, and items list, sent to group -1002667614926 thread 3 instead of just simple confirmation messages.
- System automatically completes orders in admin panel when confirmed via Telegram buttons.

# Admin Features and Order Management
- Streamlined admin order management with single-click completion replacing 3-step process.
- Admin panel displays paginated data immediately on page load with search/filter functionality.
- Admin panel pagination should use 40 items per page with server-side pagination, maintain URL state for bookmarking, preserve search/filter functionality, and follow enterprise-level UI/UX framework standards with responsive design.
- Comprehensive admin order details with product thumbnails, quantities, pricing breakdowns, customer info.
- Enhanced user profiles showing order history, total spent, and lifetime value metrics.
- Admin panel coupon management system requires full CRUD functionality.

# Testing and Quality Assurance
- Comprehensive end-to-end testing approach for e-commerce integrations, authentication flows, and responsive design.
- Systematic testing across critical user flows by clicking through interfaces, checking console errors, and verifying permissions.
- Cross-viewport testing approach for responsive design changes (320px through 1920px).
- End-to-end testing for Telegram order notification systems including security validation and webhook authorization.
- For critical production issues, always conduct thorough end-to-end testing with real data flows, verify database queries and data transformations at each step, and provide concrete evidence rather than making assumptions about fixes.
- Production admin panel has critical issues where changes don't reflect on live website - requires comprehensive end-to-end testing of admin saves, frontend reflection, cross-environment comparison, and database verification, with focus on best seller toggle and image upload features.
- For authentication and account page testing, always conduct systematic end-to-end testing including authentication flow verification, account page content validation, cross-viewport testing (375px, 768px, 1920px), error handling for protected pages, and restart development server before testing to ensure clean state.
- For authentication system testing, perform comprehensive end-to-end testing including click testing of all auth buttons, complete login flow verification with proper redirection, console monitoring for errors, user profile integration verification, and cross-page authentication state consistency testing.
- For authentication system testing, always test with browser dev tools open to monitor console errors and network requests, verify session expiration handling (clean sign-out vs valid session retention), check for authentication loops or redundant requests, and test both expired and valid session scenarios comprehensively.

# UI/UX Framework
- Enterprise-level UI/UX framework with mobile-first responsive grid, reusable component library, WCAG accessibility standards.
- Dynamic theming support, optimized form UX with inline validation, performance optimization with lazy-loading.
- Standardized micro-interactions for consistent user experience across all devices.
- Mobile UI positioning standards: search input fields should be positioned in upper portion of viewport rather than vertical center for better mobile accessibility.
- User prefers Tailwind CSS for styling.
- All click interactions should be optimized for enterprise-level standards.
- Account dropdown should appear below header (not overlay).
- Account page must meet enterprise UI/UX: mobile-first (300–414px), desktop (768–1920+), 44px touch targets, strong typography/spacing, full a11y; zero console errors/hydration issues; performance and cross-browser compliance; and include a comprehensive Playwright MCP E2E test suite validating rendering, interactions, responsiveness, navigation, and error handling.
- Desktop: place Rewards & Coupons beside Points for a denser hero area; Mobile: ensure all buttons and tab/subheading controls are visible/clickable without horizontal scrolling (no scrolling needed to reach Coupons/Progress tabs).