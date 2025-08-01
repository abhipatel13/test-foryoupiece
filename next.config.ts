// Load Node.js polyfills before any imports
require('./scripts/node-polyfills.js');

import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";
const VendorPolyfillPlugin = require('./scripts/vendor-polyfill-plugin.js');

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
    ],
    // Performance optimizations for images
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
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
    // Enable optimizations - disable optimizeCss to avoid critters dependency issue
    // Removed @radix-ui/react-icons to fix 'self is not defined' error
    optimizePackageImports: [],
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
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co https://api.boxhero.io https://accounts.google.com https://oauth2.googleapis.com wss://*.supabase.co",
              "frame-src 'self' https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; '),
          },
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
    // Apply our custom polyfill plugin to all builds
    config.plugins = config.plugins || [];
    config.plugins.push(new VendorPolyfillPlugin());

    if (isServer) {
      // Enhanced polyfill configuration
      config.plugins.push(
        new webpack.DefinePlugin({
          'typeof self': JSON.stringify('object'),
          'self': 'global',
        })
      );

      // Banner plugin to inject polyfill at the top of bundles
      config.plugins.push(
        new webpack.BannerPlugin({
          banner: `
if (typeof self === 'undefined') {
  if (typeof global !== 'undefined') {
    self = global;
  } else if (typeof globalThis !== 'undefined') {
    self = globalThis;
  }
}`,
          raw: true,
          entryOnly: false,
        })
      );

      // More comprehensive externals configuration
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        // Client-side only packages that should not run during SSR
        const clientOnlyPackages = [
          'sonner',
          'lucide-react',
          '@tanstack/react-query-devtools',
          'zustand',
          'zustand/middleware',
          // All Radix UI packages that might use browser globals
          '@radix-ui/react-toast',
          '@radix-ui/react-icons',
          '@radix-ui/react-dialog',
          '@radix-ui/react-dropdown-menu',
          '@radix-ui/react-navigation-menu',
          '@radix-ui/react-select',
          '@radix-ui/react-tabs',
          '@radix-ui/react-tooltip',
        ];

        clientOnlyPackages.forEach(pkg => {
          config.externals.push({
            [pkg]: `commonjs ${pkg}`,
          });
        });
      }

      // Resolve configuration to handle problematic modules
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        // Force server-safe versions of problematic modules
        'self': require.resolve('./scripts/node-polyfills.js'),
      };
    }

    // Only apply webpack config when not using Turbopack
    // Turbopack handles file watching and optimizations internally
    if (process.env.NODE_ENV !== 'development' || !process.env.TURBOPACK) {
      if (dev) {
        config.watchOptions = {
          poll: 1000, // Check for changes every second
          aggregateTimeout: 300, // Delay before rebuilding
          ignored: /node_modules/,
        };
      }

      // Simplified production optimizations to avoid SSR issues
      if (!dev) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: {
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true,
              },
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                priority: 10,
                chunks: 'all',
                reuseExistingChunk: true,
              },
            },
          },
        };
      }
    }

    // Fix for ChunkLoadError - add proper chunk naming
    if (!dev && !isServer) {
      config.output.chunkFilename = 'static/chunks/[name].[contenthash].js';
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
