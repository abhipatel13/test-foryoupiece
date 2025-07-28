# Admin Rate Limiting Implementation

This document describes the rate limiting implementation for the Foryoupiece admin system.

## Overview

Rate limiting has been implemented to protect admin authentication and API endpoints from abuse while maintaining normal functionality for legitimate admin users.

## Rate Limit Types

### 1. Admin Login (`admin_login`)
- **Limit**: 5 attempts per 15 minutes
- **Purpose**: Prevent brute force attacks on admin login
- **Applied to**: 
  - `/api/admin/auth/login`
  - `/api/admin/2fa/initiate`

### 2. Admin Dashboard Access (`admin_access`)
- **Limit**: 100 requests per 15 minutes
- **Purpose**: Protect dashboard resources while allowing normal usage
- **Applied to**: Admin dashboard pages and general admin operations

### 3. Admin API (`admin_api`)
- **Limit**: 200 requests per minute
- **Purpose**: General protection for admin API endpoints
- **Applied to**: Most admin API routes by default

### 4. BoxHero Sync (`admin_boxhero_sync`)
- **Limit**: 10 operations per minute
- **Purpose**: Prevent excessive external API calls to BoxHero
- **Applied to**: BoxHero sync endpoints

### 5. Bulk Operations (`admin_bulk_operations`)
- **Limit**: 50 operations per 5 minutes
- **Purpose**: Protect database from excessive bulk operations
- **Applied to**: User management, product bulk updates

## Implementation Details

### Rate Limiting Utility
Location: `src/lib/rate-limiting/admin-rate-limiter.ts`

Key functions:
- `checkAdminRateLimit()` - Check if request is within limits
- `createRateLimitResponse()` - Generate 429 error response
- `createRateLimitHeaders()` - Add rate limit headers to responses

### Middleware Integration
Location: `src/lib/auth/admin-middleware.ts`

The `withAdminAuth()` wrapper now includes rate limiting:
```typescript
export const GET = withAdminAuth(async (request, { user, adminUser }) => {
  // Your handler code
}, { rateLimitType: 'admin_api' })
```

### Rate Limit Headers

All responses include rate limiting headers:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - Unix timestamp when limit resets
- `X-RateLimit-Type` - Type of rate limit applied
- `Retry-After` - Seconds to wait before retrying (on 429 responses)

### Error Response Format

When rate limits are exceeded, a 429 status is returned:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "rateLimitInfo": {
    "type": "admin_login",
    "limit": 5,
    "remaining": 0,
    "resetTime": "2024-01-15T10:30:00.000Z",
    "retryAfter": 45
  }
}
```

## Testing

### Test Endpoint
A test endpoint is available at `/api/admin/rate-limit-test` with different HTTP methods to test various rate limit types:

- `GET` - Test general admin API rate limiting
- `POST` - Test BoxHero sync rate limiting  
- `PUT` - Test bulk operations rate limiting

### Manual Testing
1. Make multiple rapid requests to admin login endpoint
2. Verify 429 responses after exceeding limits
3. Check rate limit headers in responses
4. Confirm normal operation after reset period

## Configuration

Rate limits can be adjusted in `src/lib/rate-limiting/admin-rate-limiter.ts`:

```typescript
export const ADMIN_RATE_LIMITS = {
  admin_login: { requests: 5, windowMs: 15 * 60 * 1000 },
  admin_access: { requests: 100, windowMs: 15 * 60 * 1000 },
  // ... other limits
}
```

## Production Considerations

### Redis Integration
For production deployments with multiple servers, consider replacing the in-memory store with Redis:

```typescript
// Example Redis integration
import Redis from 'ioredis'
const redis = new Redis(process.env.REDIS_URL)

// Replace in-memory store operations with Redis commands
```

### Monitoring
Monitor rate limiting metrics:
- Number of rate limit violations
- Most frequently limited endpoints
- Admin users hitting limits

### Alerting
Set up alerts for:
- Excessive rate limit violations (potential attacks)
- Admin users consistently hitting limits (may need limit adjustments)

## Backward Compatibility

The implementation maintains backward compatibility:
- Existing admin routes continue to work
- `withAdminAuthLegacy()` wrapper available for routes that need to opt out
- Rate limiting is applied transparently without breaking existing functionality

## Security Benefits

1. **Brute Force Protection**: Login rate limiting prevents password attacks
2. **Resource Protection**: API rate limiting prevents resource exhaustion
3. **External API Protection**: BoxHero sync limits prevent quota exhaustion
4. **Database Protection**: Bulk operation limits prevent database overload

## Performance Impact

- Minimal overhead (in-memory operations)
- Automatic cleanup of expired entries
- Headers added to responses without significant delay
- No impact on normal admin usage patterns
