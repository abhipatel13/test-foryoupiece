# 🔧 Environment Variables Setup Guide

⚠️ **SECURITY WARNING**: This documentation uses placeholder values only. Never commit real API keys, tokens, or credentials to version control. Replace all placeholder values with your actual credentials in your local `.env.local` file.

## 📋 Complete Environment Variables List

### 🔥 REQUIRED for Development & Testing

Create `.env.local` file in your project root:

```bash
# ===== SUPABASE CONFIGURATION (REQUIRED) =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# ===== SITE CONFIGURATION (REQUIRED) =====
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-development-key-min-32-chars-here

# ===== BOXHERO INTEGRATION (REQUIRED) =====
BOXHERO_API_TOKEN=your_boxhero_api_token_here

# ===== ADMIN AUTHENTICATION (SERVER-SIDE ONLY) =====
ADMIN_EMAIL=your_admin_email_here
# Note: Admin email is now server-side only for better security
# Client components fetch this via secure API endpoint

# ===== DEVELOPMENT SETTINGS (REQUIRED FOR WINDOWS) =====
NODE_ENV=development
NEXT_WEBPACK_USEPOLLING=1

# ===== TELEGRAM BOT (OPTIONAL FOR DEVELOPMENT) =====
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_telegram_bot_username_here
NEXT_PUBLIC_TELEGRAM_BOT_ID=your_telegram_bot_id_here
```

## 🚀 Vercel Production Environment Variables

Configure these in Vercel Dashboard > Project Settings > Environment Variables:

### Required Variables:

| Variable Name | Value | Environment | Notes |
|---------------|-------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-id.supabase.co` | All | ✅ Safe for client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your_supabase_anon_key_here` | All | ✅ Safe for client |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_supabase_service_role_key_here` | All | ❌ Server-side only |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | Production | ✅ Safe for client |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | Production | ❌ Server-side only |
| `NEXTAUTH_SECRET` | `your-production-secret-key` | All | ❌ Server-side only |
| `BOXHERO_API_TOKEN` | `your_boxhero_api_token_here` | All | ❌ Server-side only |
| `TELEGRAM_BOT_TOKEN` | `8066090295:AAHmPDgCvuCA7qrQAF6lGFl1j-AGSZG0zio` | All | ❌ Server-side only |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `Authenticationfypbot` | All | ✅ Safe for client |
| `NEXT_PUBLIC_TELEGRAM_BOT_ID` | `8066090295` | All | ✅ Safe for client |

## 🧪 Testing Environment Variables

For testing, use the same development variables but consider:

```bash
# Testing-specific overrides (optional)
NODE_ENV=test
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🔍 How to Get Each Variable

### Supabase Variables:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `xhfmyghtcugcocchzgja`
3. Go to Settings > API
4. Copy:
   - **URL**: `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role**: `SUPABASE_SERVICE_ROLE_KEY`

### BoxHero API Token:
1. Login to [BoxHero](https://boxhero-app.com)
2. Go to Settings > API
3. Generate or copy existing token
4. Use as `BOXHERO_API_TOKEN`

### Telegram Bot:
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create new bot or use existing: `Authenticationfypbot`
3. Copy token for `TELEGRAM_BOT_TOKEN`
4. Bot username: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
5. Bot ID: `NEXT_PUBLIC_TELEGRAM_BOT_ID`

### NextAuth Secret:
Generate a secure random string (minimum 32 characters):
```bash
# Generate with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## ⚠️ Important Security Notes

### ✅ Safe for Client-Side (NEXT_PUBLIC_ prefix):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- `NEXT_PUBLIC_TELEGRAM_BOT_ID`
- `NEXT_PUBLIC_SITE_URL`

### ❌ Must Keep Secret (No NEXT_PUBLIC_ prefix):
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOXHERO_API_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `NEXTAUTH_SECRET`

## 🚀 Quick Setup Commands

```bash
# 1. Clone and install
git clone https://github.com/AKito1013/foryoupiece-web.git
cd foryoupiece-web
npm install

# 2. Create environment file
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start development server
npm run dev

# 4. Open browser
# http://localhost:3000
```

## 🔧 Troubleshooting

### Common Issues:

1. **Build fails with "supabaseUrl is required"**
   - Ensure `NEXT_PUBLIC_SUPABASE_URL` is set
   - Check for typos in variable names

2. **Telegram login not working**
   - Verify `TELEGRAM_BOT_TOKEN` is correct
   - Ensure bot is active and configured

3. **BoxHero sync fails**
   - Check `BOXHERO_API_TOKEN` is valid
   - Verify API token has proper permissions

4. **Windows file watching issues**
   - Ensure `NEXT_WEBPACK_USEPOLLING=1` is set
   - Restart development server

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Verify all environment variables are set correctly
3. Restart your development server
4. Check the console for specific error messages

Remember: **Never commit `.env.local` to version control!**
