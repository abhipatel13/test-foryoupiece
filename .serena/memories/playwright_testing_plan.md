# Playwright Mobile Cart Testing Plan

## TEST VIEWPORT SPECIFICATIONS

### Target Mobile Viewports
1. **320px x 568px** - iPhone SE / Small mobile
2. **375px x 812px** - iPhone 12/13/14 Pro 
3. **414px x 896px** - iPhone 12/13/14 Pro Max

### Test Categories

#### 1. Coupon Functionality Tests
- ✅ Coupon input field visible and accessible on mobile
- ✅ Apply button has proper touch target (≥44px)
- ✅ Coupon validation works (valid/invalid codes)
- ✅ Error messages display correctly
- ✅ Applied coupon shows discount amount
- ✅ Remove coupon functionality works

#### 2. Points Redemption Tests
- ✅ Points balance display is readable on mobile
- ✅ Points input field accepts numeric input
- ✅ Quick select buttons are properly sized for touch
- ✅ Validation rules enforce (500 min, 10 increments)
- ✅ Applied points show discount calculation
- ✅ Clear points functionality works

#### 3. Layout & Responsive Tests
- ✅ Components visible in main cart flow on mobile
- ✅ Components hidden from desktop sidebar on mobile
- ✅ Touch targets meet 44px minimum requirement
- ✅ Text is readable without horizontal scrolling
- ✅ Form elements properly spaced for fat finger navigation

#### 4. Integration Tests
- ✅ Order total updates correctly with coupons/points
- ✅ Checkout button reflects final price
- ✅ Cart quantity changes don't break coupon/points
- ✅ Page refresh maintains applied coupons/points
- ✅ No JavaScript console errors

#### 5. Cross-Viewport Tests
- ✅ Functionality works across all three viewport sizes
- ✅ Desktop functionality unaffected (≥1024px)
- ✅ Smooth transitions between breakpoints