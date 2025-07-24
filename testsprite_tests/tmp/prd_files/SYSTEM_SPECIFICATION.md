# ForYouPiece E-commerce System Specification

## Project Overview

**ForYouPiece** is a modern, full-stack e-commerce platform built with Next.js 15, featuring a comprehensive admin panel, multi-language support, and advanced product management capabilities. The system is designed with Amazon-inspired UX patterns and focuses on delivering premium quality products worldwide.

## System Architecture

### Technology Stack

#### Frontend
- **Framework**: Next.js 15.4.1 with App Router
- **React**: 19.1.0 with React DOM 19.1.0
- **TypeScript**: 5.x for type safety
- **Styling**: Tailwind CSS 4.x with custom components
- **UI Components**: Radix UI primitives with custom styling
- **Icons**: Lucide React 0.525.0
- **Internationalization**: next-intl 4.3.4
- **State Management**: Zustand 5.0.6
- **Form Handling**: React Hook Form 7.60.0 with Zod validation
- **Data Fetching**: TanStack Query 5.83.0
- **Notifications**: Sonner 2.0.6
- **Charts**: Recharts 3.1.0

#### Backend & Database
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with Google OAuth 2.0 and Telegram Login Widget
- **Storage**: Supabase Storage for product images
- **API**: Next.js API Routes with TypeScript
- **Real-time**: Supabase Realtime subscriptions

#### Development Tools
- **Linting**: ESLint 9.x with Next.js configuration
- **Package Manager**: npm
- **Build Tool**: Next.js with Turbopack (development)
- **Testing**: Puppeteer 23.11.1 for E2E testing

### Architecture Patterns

#### Domain-Driven Design (DDD)
```
src/
├── app/                    # Next.js App Router
├── application/           # Application services and use cases
├── components/           # Reusable UI components
├── domain/              # Business logic and entities
├── infrastructure/      # External services and adapters
├── lib/                # Shared utilities and configurations
├── presentation/       # UI-specific logic and hooks
└── shared/            # Cross-cutting concerns
```

#### Clean Architecture Layers
1. **Presentation Layer**: React components and pages
2. **Application Layer**: Use cases and application services
3. **Domain Layer**: Business entities and rules
4. **Infrastructure Layer**: Database, external APIs, and services

## Core Features

### 1. Multi-Language Support
- **Supported Languages**: English (primary), Japanese
- **Implementation**: next-intl with locale-based routing
- **URL Structure**: `/[locale]/...` (e.g., `/en/products`, `/ja/products`)
- **Fallback**: English as default language

### 2. Authentication System
- **Google OAuth 2.0**: Primary authentication method
- **Telegram Login Widget**: Alternative authentication (production domains only)
- **Admin Authentication**: Separate secure admin access with role-based permissions
- **Guest Access**: Temporary login functionality for testing

### 3. Product Management
- **Comprehensive CRUD**: Full product lifecycle management
- **Multi-language Content**: English and Japanese product information
- **Image Management**: Upload, view, and delete product images
- **Inventory Tracking**: Stock levels, low stock alerts, backorder support
- **SEO Optimization**: Meta titles and descriptions
- **Pricing**: Regular price, compare-at price, and cost price tracking

### 4. Admin Panel (`/fyponly-admin`)
- **Secure Access**: Obscured routes with strict role-based access control
- **Dashboard**: Analytics and system overview
- **Product Management**: Advanced product editing and bulk operations
- **Order Management**: Order processing and tracking
- **User Management**: Customer account administration
- **BoxHero Integration**: Inventory synchronization
- **Reports**: Comprehensive business analytics

### 5. E-commerce Features
- **Product Catalog**: Categorized product browsing
- **Shopping Cart**: Persistent cart with local storage
- **Checkout Process**: Streamlined purchase flow
- **Order Management**: Order history and tracking
- **Search**: Advanced product search functionality
- **Filtering**: Category and feature-based filtering

## Database Schema

### Core Tables
- **products**: Product information with multi-language support
- **categories**: Product categorization
- **orders**: Order management and tracking
- **order_items**: Individual order line items
- **users**: User profiles and authentication data
- **user_profiles**: Extended user information
- **inventory**: Stock tracking and management

### Security
- **Row Level Security (RLS)**: Comprehensive data access policies
- **Admin Functions**: Secure database functions for admin operations
- **Data Validation**: Server-side validation with Zod schemas

## Development Environment

### Local Development Setup

#### Prerequisites
- Node.js 18+ 
- npm package manager
- Supabase account and project

#### Environment Configuration
```bash
# .env.local (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BOXHERO_API_TOKEN=your_boxhero_token

# Windows-Specific Settings
NEXT_WEBPACK_USEPOLLING=1
```

#### Development Commands
```bash
# Install dependencies
npm install

# Start development server with Turbopack
npm run dev

# Start fresh development (clear cache)
npm run dev:fresh

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Clear Next.js cache
npm run clear-cache
```

### Windows-Specific Optimizations
- **File Watching**: Webpack polling enabled for better file change detection
- **Cache Management**: Automated cache clearing scripts
- **Performance**: Optimized webpack configuration for Windows development

## Deployment

### Production Environment
- **Platform**: Vercel (recommended) or any Node.js hosting
- **Domain**: Custom domain with SSL
- **Environment Variables**: Production-specific configuration
- **Build Optimization**: Automatic code splitting and optimization

### Performance Optimizations
- **Image Optimization**: Next.js Image component with WebP/AVIF support
- **Code Splitting**: Automatic vendor and page-level splitting
- **Caching**: Comprehensive caching strategy
- **Compression**: Gzip compression enabled
- **Bundle Analysis**: Optimized package imports

## Security Features

### Authentication Security
- **OAuth 2.0**: Secure third-party authentication
- **JWT Tokens**: Secure session management
- **Role-Based Access**: Admin and user role separation
- **Session Management**: Automatic token refresh

### Data Security
- **Row Level Security**: Database-level access control
- **Input Validation**: Comprehensive data validation
- **CSRF Protection**: Built-in Next.js protection
- **Secure Headers**: Security-focused HTTP headers

### Admin Security
- **Obscured Routes**: Non-obvious admin URLs
- **Strict Access Control**: Multi-layer permission checks
- **Audit Logging**: Admin action tracking
- **Secure Functions**: Database-level admin operations

## API Documentation

### Public APIs
- **Products**: Product catalog and search
- **Categories**: Product categorization
- **Auth**: Authentication endpoints
- **Cart**: Shopping cart management

### Admin APIs
- **Product Management**: CRUD operations
- **Order Management**: Order processing
- **User Management**: Customer administration
- **Analytics**: Business intelligence data
- **BoxHero Sync**: Inventory synchronization

## Testing Strategy

### End-to-End Testing
- **Framework**: Playwright with Puppeteer
- **Coverage**: Critical user journeys
- **Admin Testing**: Comprehensive admin panel testing
- **Cross-Browser**: Chrome and Firefox compatibility

### Quality Assurance
- **TypeScript**: Compile-time type checking
- **ESLint**: Code quality and consistency
- **Automated Testing**: CI/CD integration
- **Manual Testing**: User acceptance testing

## Monitoring and Analytics

### Performance Monitoring
- **Core Web Vitals**: Performance metrics tracking
- **Error Tracking**: Comprehensive error logging
- **User Analytics**: Behavior and conversion tracking
- **Admin Analytics**: Business intelligence dashboard

### System Health
- **Database Monitoring**: Query performance and health
- **API Monitoring**: Endpoint performance tracking
- **Storage Monitoring**: File upload and storage health
- **Authentication Monitoring**: Login success rates

## Maintenance and Support

### Regular Maintenance
- **Dependency Updates**: Regular package updates
- **Security Patches**: Timely security updates
- **Performance Optimization**: Ongoing performance improvements
- **Database Maintenance**: Regular database optimization

### Backup and Recovery
- **Database Backups**: Automated Supabase backups
- **File Storage**: Redundant storage with Supabase
- **Configuration Backup**: Environment and configuration versioning
- **Disaster Recovery**: Comprehensive recovery procedures

## Future Roadmap

### Planned Features
- **Mobile App**: React Native mobile application
- **Advanced Analytics**: Enhanced business intelligence
- **Multi-Currency**: International currency support
- **Advanced Search**: AI-powered search and recommendations
- **Inventory Automation**: Advanced inventory management

### Technical Improvements
- **Microservices**: Service-oriented architecture migration
- **CDN Integration**: Global content delivery
- **Advanced Caching**: Redis integration
- **Real-time Features**: Enhanced real-time capabilities

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintainer**: ForYouPiece Development Team
