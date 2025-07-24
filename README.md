# ForYouPiece E-commerce Platform

A modern, secure e-commerce platform built with Next.js 15, Supabase, and TypeScript. Features include multi-provider authentication, inventory management, admin dashboard, and comprehensive security.

## 🚀 Quick Start

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🔧 Environment Setup

### Development Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Site Configuration (Development)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_development_secret_key

# BoxHero Integration (Inventory Management)
BOXHERO_API_TOKEN=your_boxhero_api_token

# Telegram Bot Configuration (Optional for development)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_TELEGRAM_BOT_ID=your_bot_id

# Development & Performance (Windows-Specific)
NODE_ENV=development
NEXT_WEBPACK_USEPOLLING=1
```

### Production Environment Variables (Vercel)

Configure these in your Vercel dashboard under Project Settings > Environment Variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Site Configuration (Production)
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your_production_secret_key

# BoxHero Integration
BOXHERO_API_TOKEN=your_boxhero_api_token

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_TELEGRAM_BOT_ID=your_bot_id
```

## 🔒 Security Notes

- **NEVER** commit `.env.local` to version control
- Use different API tokens for development and production
- See `SECURITY.md` for detailed security guidelines
- Only variables prefixed with `NEXT_PUBLIC_` are exposed to the client-side

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
