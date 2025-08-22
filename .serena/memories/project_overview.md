# ForYouPiece E-commerce Platform

## Purpose
Modern, secure e-commerce platform with inventory management, admin dashboard, and multi-provider authentication.

## Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Radix UI components
- **Backend**: Supabase (auth, database)
- **State**: Zustand, React Query
- **Testing**: Playwright
- **Deployment**: Vercel

## Key Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run dev:fresh` - Clear cache and start dev
- `npm test` - Run Playwright tests

## Architecture
- `/src/app` - Next.js App Router pages
- `/src/components` - Reusable UI components
- `/src/hooks` - Custom React hooks
- `/src/lib` - Utilities and configurations
- `/src/types` - TypeScript type definitions