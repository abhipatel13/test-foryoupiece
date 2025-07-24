# 🔒 ForYouPiece E-commerce Security Guide

## Environment Variables Security Configuration

### ✅ SAFE TO EXPOSE (NEXT_PUBLIC_ prefix)

These environment variables are designed to be publicly accessible and are safe for client-side use:

#### **NEXT_PUBLIC_SUPABASE_URL**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xhfmyghtcugcocchzgja.supabase.co
```
- ✅ **Safe**: Supabase project URL is public by design
- **Purpose**: Required for client-side Supabase connections
- **Protection**: Database access is controlled by Row Level Security (RLS) policies

#### **NEXT_PUBLIC_SUPABASE_ANON_KEY**
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ✅ **Safe**: Anonymous key is designed for public exposure
- **Purpose**: Enables client-side authentication and public data access
- **Protection**: 
  - Cannot bypass Row Level Security (RLS) policies
  - Only allows access to data permitted by RLS rules
  - Cannot access admin functions or private user data

#### **NEXT_PUBLIC_TELEGRAM_BOT_USERNAME & NEXT_PUBLIC_TELEGRAM_BOT_ID**
```bash
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=Authenticationfypbot
NEXT_PUBLIC_TELEGRAM_BOT_ID=8066090295
```
- ✅ **Safe**: Bot username and ID are public information
- **Purpose**: Required for Telegram Login Widget integration
- **Protection**: Cannot be used to send messages or access bot functions

#### **NEXT_PUBLIC_SITE_URL**
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
- ✅ **Safe**: Site URL is public information
- **Purpose**: Used for redirects and OAuth callbacks

### ❌ MUST KEEP SECRET (Server-side only)

These environment variables contain sensitive information and must NEVER be prefixed with NEXT_PUBLIC_:

#### **SUPABASE_SERVICE_ROLE_KEY**
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ❌ **CRITICAL**: Can bypass all Row Level Security policies
- **Purpose**: Admin operations and database management
- **Usage**: Server-side API routes only

#### **TELEGRAM_BOT_TOKEN**
```bash
TELEGRAM_BOT_TOKEN=8066090295:AAHmPDgCvuCA7qrQAF6lGFl1j-AGSZG0zio
```
- ❌ **CRITICAL**: Can control your Telegram bot
- **Purpose**: Send messages and manage bot functions
- **Usage**: Server-side API routes only

#### **BOXHERO_API_TOKEN**
```bash
BOXHERO_API_TOKEN=a827b827-36f7-4e0e-b66b-db6990469aaa
```
- ❌ **CRITICAL**: Full access to BoxHero inventory system
- **Purpose**: Inventory synchronization and management
- **Usage**: Server-side API routes only

#### **NEXTAUTH_SECRET**
```bash
NEXTAUTH_SECRET=your_nextauth_secret
```
- ❌ **CRITICAL**: Used for JWT signing and encryption
- **Purpose**: Authentication session security
- **Usage**: NextAuth.js internal operations

## 🛡️ Row Level Security (RLS) Configuration

### Database Security Policies

All database tables have comprehensive RLS policies that protect data access:

#### **Products Table**
```sql
-- Public can view active products only
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = TRUE);

-- Only admins can modify products
CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        auth.role() = 'service_role' OR is_admin(auth.uid())
    );
```

#### **Orders Table**
```sql
-- Users can only see their own orders
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders" ON orders
    FOR SELECT USING (is_admin(auth.uid()));
```

#### **Admin Users Table**
```sql
-- Only super admins can manage admin users
CREATE POLICY "Super admins can manage admin users" ON admin_users
    FOR ALL USING (is_super_admin(auth.uid()));
```

### Admin Authentication

Admin access is protected by multiple layers:

1. **User Authentication**: Must be logged in with valid Supabase session
2. **Admin Role Check**: Must have entry in `admin_users` table with `is_active = true`
3. **Permission Verification**: Role-based permissions for specific operations
4. **Email Verification**: Super admin role requires specific email address

## 🚨 Security Best Practices

### Environment Variable Management

1. **Never commit sensitive tokens to version control**
2. **Use different tokens for development and production**
3. **Rotate API tokens regularly**
4. **Monitor token usage and access logs**

### Deployment Security

1. **Configure environment variables in Vercel dashboard**
2. **Never expose server-side variables to client**
3. **Use HTTPS in production**
4. **Enable CORS restrictions**

### Database Security

1. **All tables have RLS enabled**
2. **Regular security audits of RLS policies**
3. **Monitor database access logs**
4. **Use service role key only for admin operations**

## 🔧 Security Verification Checklist

- [ ] No NEXT_PUBLIC_ prefix on sensitive tokens
- [ ] All database tables have RLS enabled
- [ ] Admin functions require proper authentication
- [ ] API tokens are not hardcoded in client-side code
- [ ] Environment variables are properly configured in deployment
- [ ] Regular security audits are performed

## 📞 Security Contact

For security issues or questions, contact the development team immediately.

**Remember**: When in doubt, keep it secret. It's better to be overly cautious with sensitive information.
