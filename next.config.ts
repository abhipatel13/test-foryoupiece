import {withSentryConfig} from '@sentry/nextjs';
// Global polyfill for 'self' - must be at the very top before any imports
if (typeof global !== 'undefined' && typeof (global as any).self === 'undefined') {
  (global as any).self = global;
}
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).self === 'undefined') {
  (globalThis as any).self = globalThis;
}

import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

// Bundle analyzer for performance optimization (safe optional usage)
let withBundleAnalyzer: (cfg: any) => any = (cfg: any) => cfg
if (process.env.ANALYZE === 'true') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const createAnalyzer = require('@next/bundle-analyzer')
    withBundleAnalyzer = createAnalyzer({ enabled: true })
  } catch (err) {
    console.warn("@next/bundle-analyzer not installed; skipping analysis:", (err as any)?.message ?? err)
  }
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'foryoupiece.com',
      },
      {
        protocol: 'https',
        hostname: 'd3l9wd8kivvlqy.cloudfront.net',
      },
    ],
    // PERFORMANCE OPTIMIZATION: Multiple formats for better compression and extended cache TTL
    formats: ['image/avif', 'image/webp'], // AVIF for better compression, WebP fallback
    minimumCacheTTL: 2678400, // 31 days cache for product images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.vercel.app',
        'foryoupiece.vercel.app',
        'foryoupiece-ecommerce.vercel.app'
      ],
    },
    // PERFORMANCE OPTIMIZATION: Enable package import optimization for better tree-shaking
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-button',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select'
    ],
  },
  // Stable Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks - Allow Telegram for authentication
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Content Security Policy is now set dynamically in middleware with per-request nonce
          // to support strict CSP without 'unsafe-inline' or 'unsafe-eval'.
          // (Header removed here to avoid conflicts.)
          // Permissions Policy (Feature Policy)
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'interest-cohort=()'
            ].join(', '),
          },
        ],
      },
      {
        // COST OPTIMIZATION: Long-term caching for static product images
        source: '/images/products/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2678400, immutable', // 31 days cache
          },
        ],
      },
      {
        // IMPORTANT: Favicons and manifest should revalidate more often to avoid stale branding
        source: '/(favicon\.ico|favicon\.jpg|site\.webmanifest)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 1 day cache, no immutable so browsers can refresh
          },
        ],
      },
      {
        // COST OPTIMIZATION: Long-term caching for static assets (exclude favicons so branding updates propagate)
        // Note: Favicons are handled by the dedicated rule above with a short TTL
        source: '/(logo|qr-payment|file|globe|next|vercel|window)\\.(ico|jpg|jpeg|png|svg|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year cache for static assets
          },
        ],
      },
      {
        // Additional security for admin routes
        source: '/en/fyponly-admin/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ];
  },
  // Webpack configuration for server-side compatibility
  webpack: (config, { dev, isServer, webpack }) => {
    if (isServer) {
      // Simple polyfill configuration
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.DefinePlugin({
          'self': 'global',
        })
      );

      // Simple externals configuration
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'sonner': 'commonjs sonner',
          'lucide-react': 'commonjs lucide-react',
          '@tanstack/react-query-devtools': 'commonjs @tanstack/react-query-devtools',
          'zustand': 'commonjs zustand',
          '@radix-ui/react-toast': 'commonjs @radix-ui/react-toast',
          '@radix-ui/react-icons': 'commonjs @radix-ui/react-icons',
        });
      }
    }

    // Simple development configuration (Windows polling gated by NEXT_WEBPACK_USEPOLLING)
    if (dev && process.env.NEXT_WEBPACK_USEPOLLING === '1') {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }

    return config;
  },
};

export default withSentryConfig(withBundleAnalyzer(withNextIntl(nextConfig)), {
// For all available options, see:
// https://www.npmjs.com/package/@sentry/webpack-plugin#options

org: "aoyama",
project: "javascript-nextjs",

// Only print logs for uploading source maps in CI
silent: !process.env.CI,

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// Upload a larger set of source maps for prettier stack traces (increases build time)
widenClientFileUpload: true,

// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
// This can increase your server load as well as your hosting bill.
// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
// side errors will fail.
tunnelRoute: "/monitoring",

// Automatically tree-shake Sentry logger statements to reduce bundle size
disableLogger: true,

// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
// See the following for more information:
// https://docs.sentry.io/product/crons/
// https://vercel.com/docs/cron-jobs
automaticVercelMonitors: true,
});