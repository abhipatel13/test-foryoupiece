# 🔐 ForYouPiece Security Guidelines

## 🎯 Overview

This document provides comprehensive security guidelines for the ForYouPiece e-commerce application development and deployment.

## 🔑 Environment Variables Security

### ✅ DO's

1. **Use Environment Variables for All Secrets**
   ```bash
   # ✅ Good
   SUPABASE_SERVICE_ROLE_KEY=your_secret_here
   BOXHERO_API_TOKEN=your_token_here
   ```

2. **Use .env.local for Development**
   ```bash
   # Copy template and fill with real values
   cp .env.local.example .env.local
   ```

3. **Keep .env Files Out of Git**
   ```gitignore
   # ✅ Always ignore
   .env*
   .env.local
   .env.production
   .env.development
   ```

4. **Use Placeholder Templates**
   ```bash
   # ✅ Safe to commit
   SUPABASE_URL=https://your-project-id.supabase.co
   API_TOKEN=your_api_token_here
   ```

### ❌ DON'Ts

1. **Never Hardcode Secrets in Code**
   ```javascript
   // ❌ Never do this
   const apiKey = "sk-1234567890abcdef"
   const dbUrl = "postgresql://user:pass@host:5432/db"
   ```

2. **Never Commit Real Environment Files**
   ```bash
   # ❌ Never commit these
   .env.local
   .env.production
   config/secrets.json
   ```

3. **Never Use Production Secrets in Development**
   ```bash
   # ❌ Don't use prod tokens locally
   PROD_API_KEY=real_production_key
   ```

## 🧪 Test File Security

### ✅ Secure Test Practices

1. **Use Environment Variables in Tests**
   ```javascript
   // ✅ Good
   const apiToken = process.env.BOXHERO_API_TOKEN
   if (!apiToken) {
     console.error('API token not configured')
     process.exit(1)
   }
   ```

2. **Add Security Warnings**
   ```javascript
   // ✅ Always include warnings
   // ⚠️ SECURITY WARNING: This script uses real API credentials
   // Only use in development environment
   ```

3. **Use Mock Data When Possible**
   ```javascript
   // ✅ Prefer mock data
   const mockUser = { id: 'test-user', email: 'test@example.com' }
   ```

### ❌ Insecure Test Practices

1. **Never Hardcode Test Credentials**
   ```javascript
   // ❌ Never do this
   const testPassword = "password123"
   const apiKey = "sk-real-api-key"
   ```

2. **Never Use Production Data in Tests**
   ```javascript
   // ❌ Don't test against production
   const prodDbUrl = "postgresql://prod-server/db"
   ```

## 🚀 Deployment Security

### Production Environment Setup

1. **Use Platform Environment Variables**
   ```bash
   # Vercel Dashboard > Settings > Environment Variables
   SUPABASE_SERVICE_ROLE_KEY=prod_key_here
   NEXTAUTH_SECRET=strong_random_secret
   ```

2. **Separate Development and Production**
   ```bash
   # Development
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   
   # Production  
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   ```

3. **Use Strong Secrets**
   ```bash
   # ✅ Generate strong secrets
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   ```

### Security Headers

1. **Content Security Policy**
   ```javascript
   // next.config.ts
   headers: [
     {
       source: '/(.*)',
       headers: [
         {
           key: 'Content-Security-Policy',
           value: "default-src 'self'; script-src 'self' 'unsafe-eval'"
         }
       ]
     }
   ]
   ```

## 🔄 Credential Management

### Rotation Schedule

1. **API Keys**: Every 90 days
2. **Database Passwords**: Every 180 days  
3. **JWT Secrets**: Every 365 days
4. **Webhook Secrets**: Every 180 days

### Emergency Rotation

If credentials are exposed:
1. **Immediately rotate** all affected credentials
2. **Update environment variables** in all environments
3. **Redeploy applications** with new credentials
4. **Monitor for unauthorized access**

## 🛡️ Code Security

### Input Validation

```typescript
// ✅ Always validate inputs
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

const validatedData = userSchema.parse(input)
```

### SQL Injection Prevention

```typescript
// ✅ Use parameterized queries
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', userEmail) // Safe

// ❌ Never use string concatenation
const query = `SELECT * FROM users WHERE email = '${userEmail}'` // Dangerous
```

### Authentication Security

```typescript
// ✅ Proper session validation
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  return redirect('/login')
}
```

## 📊 Monitoring and Alerting

### Security Monitoring

1. **Failed Login Attempts**
   - Monitor for brute force attacks
   - Implement rate limiting
   - Alert on suspicious patterns

2. **API Usage Monitoring**
   - Track unusual API usage patterns
   - Monitor for credential misuse
   - Set up usage alerts

3. **Error Monitoring**
   - Monitor for security-related errors
   - Track authentication failures
   - Alert on system vulnerabilities

### Logging Best Practices

```typescript
// ✅ Log security events
console.log('🔐 User login attempt:', { 
  userId: user.id, 
  timestamp: new Date().toISOString(),
  ip: request.ip 
})

// ❌ Never log sensitive data
console.log('User password:', password) // Never do this
```

## 🔍 Security Auditing

### Regular Audits

1. **Monthly**: Dependency vulnerability scans
2. **Quarterly**: Credential rotation review
3. **Annually**: Comprehensive security audit

### Audit Checklist

- [ ] All secrets in environment variables
- [ ] No hardcoded credentials in code
- [ ] .env files properly ignored
- [ ] Production credentials rotated
- [ ] Security headers configured
- [ ] Input validation implemented
- [ ] Authentication properly secured
- [ ] Monitoring and alerting active

## 🚨 Incident Response

### If Security Breach Detected

1. **Immediate Actions**
   - Rotate all potentially compromised credentials
   - Block suspicious IP addresses
   - Notify security team

2. **Investigation**
   - Review access logs
   - Identify scope of breach
   - Document findings

3. **Recovery**
   - Patch vulnerabilities
   - Update security measures
   - Communicate with stakeholders

## 📚 Resources

### Security Tools

- **Dependency Scanning**: `npm audit`
- **Secret Scanning**: GitHub Advanced Security
- **Code Analysis**: ESLint security rules
- **Environment Validation**: Custom scripts

### Documentation

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

**Last Updated**: August 5, 2025  
**Next Review**: September 5, 2025  
**Owner**: Development Team
