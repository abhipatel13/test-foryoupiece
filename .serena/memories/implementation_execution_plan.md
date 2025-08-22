# Mobile Cart Implementation Execution Plan

## SOLUTION ARCHITECTURE

### Strategy: Conditional Rendering Based on Screen Size
**Desktop (≥lg)**: Keep components in right sidebar (existing behavior)
**Mobile/Tablet (<lg)**: Show components in main cart flow after order summary

### Implementation Approach
1. **Duplicate component placement** with responsive visibility classes
2. **Mobile placement**: Insert after Order Summary section (line ~587 in cart page)
3. **Desktop placement**: Keep existing sidebar placement (line ~700)
4. **Responsive classes**:
   - Mobile version: `lg:hidden` (show on mobile, hide on desktop)
   - Desktop version: `hidden lg:block` (hide on mobile, show on desktop)

## SPECIFIC CODE CHANGES

### File: `src/app/[locale]/cart/page.tsx`

#### Change 1: Add Mobile Coupon/Points Section
**Location**: After Order Summary (around line 587)
**Action**: Insert mobile-optimized section with both components

#### Change 2: Preserve Desktop Sidebar
**Location**: Lines 700-720 (existing sidebar placement)
**Action**: No changes needed - already has `hidden lg:block`

## MOBILE LAYOUT FLOW (320px-414px)
1. Cart Items Section ✅
2. Order Summary Section ✅
3. **NEW: Coupon Input (mobile)** 🔥
4. **NEW: Points Redemption (mobile)** 🔥
5. Checkout Button ✅
6. Continue Shopping Section ✅

## DESKTOP LAYOUT PRESERVED (≥1024px)
- Main cart (left 3/4): Cart Items + Order Summary + Checkout
- Sidebar (right 1/4): Additional Options + Coupon + Points ✅

## VALIDATION
- ✅ Components already mobile-ready
- ✅ Touch targets already compliant
- ✅ Validation rules already implemented
- ✅ Error handling already in place