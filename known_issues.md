# Known Issues and Resolutions

## PostgreSQL Duplicate Key Constraint Error (Resolved)

**Issue**: Order creation failing with PostgreSQL error code 23505 (duplicate key constraint violation)

**Root Cause**: The error was caused by a `users_phone` unique constraint violation during user profile updates in the checkout process, not the `order_number` field as initially suspected.

**Symptoms**:
- Frontend displaying "Failed to place order. Please try again."
- Empty error objects `{}` in console logs
- HTTP 409 status responses from order creation API
- No detailed error information for debugging

**Resolution Implemented**:

1. **Enhanced API Error Handling**:
   - Fixed critical `throw orderError;` issue causing empty error responses
   - Added comprehensive error logging with detailed database error information
   - Implemented proper error response formatting with error details
   - Added health check endpoint (`GET /api/orders/create`) for API testing

2. **Improved Frontend Error Handling**:
   - Enhanced error logging to capture detailed API response information
   - Added specific error message handling for different error types
   - Improved user feedback with more descriptive error messages

3. **Robust Order Number Generation**:
   - Enhanced order number format: `FYP-YYYYMMDD-{timestamp}-{random}`
   - Retry logic with exponential backoff for duplicate key constraints
   - Comprehensive logging for debugging

**Technical Details**:
- **Error Code**: PostgreSQL 23505 (duplicate key constraint violation)
- **Affected Constraint**: `users_phone` unique constraint
- **API Route**: `/api/orders/create`
- **Resolution Date**: January 2025

**Prevention Measures**:
- Comprehensive error handling in all API routes
- Detailed error logging for database operations
- Proper error response formatting with status codes
- Enhanced frontend error display and logging
