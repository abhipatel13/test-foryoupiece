import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Import and apply Node.js polyfills immediately
require('./scripts/node-polyfills.js');
require('./scripts/aggressive-polyfill.js');

// Import custom webpack plugin
const WebpackPolyfillPlugin = require('./scripts/webpack-polyfill-plugin.js');

// Emergency global polyfill for 'self' in Node.js environment
if (typeof globalThis !== 'undefined' && typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
  console.log('🔧 Emergency polyfill: globalThis.self applied in next.config.ts');
}

// Ensure 'self' is defined in global scope for server-side rendering
if (typeof global !== 'undefined' && typeof (global as any).self === 'undefined') {
  (global as any).self = global;
  console.log('🔧 Emergency polyfill: global.self applied in next.config.ts');
}

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
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
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
  // Conditional webpack configuration (only when not using Turbopack)
  webpack: (config, { dev, isServer, webpack }) => {
    // Add comprehensive polyfills for browser globals in server environment
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };

      // Exclude client-only packages from server-side bundling
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'sonner': 'commonjs sonner',
          'lucide-react': 'commonjs lucide-react',
          '@tanstack/react-query-devtools': 'commonjs @tanstack/react-query-devtools',
        });
      }

      // Define browser globals for server environment
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.DefinePlugin({
          'typeof window': JSON.stringify('undefined'),
          'typeof document': JSON.stringify('undefined'),
          'typeof navigator': JSON.stringify('undefined'),
          'typeof self': JSON.stringify('object'),
          'self': 'global',
          'window': 'undefined',
          'document': 'undefined',
          'navigator': 'undefined',
        })
      );

      // Add ProvidePlugin to provide global polyfills
      config.plugins.push(
        new webpack.ProvidePlugin({
          self: 'global',
        })
      );

      // Add custom polyfill plugin
      config.plugins.push(new WebpackPolyfillPlugin());

      // Add banner plugin to inject polyfills at the start of every bundle
      config.plugins.push(
        new webpack.BannerPlugin({
          banner: `
// Next.js Build Polyfill - Emergency 'self' definition
if (typeof self === 'undefined') {
  if (typeof global !== 'undefined') {
    self = global;
  } else if (typeof globalThis !== 'undefined') {
    self = globalThis;
  } else {
    self = {};
  }
}`,
          raw: true,
          entryOnly: false,
        })
      );

      // Add polyfill to webpack entry to ensure it runs first
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();

        // Add polyfill to all entry points
        Object.keys(entries).forEach((key) => {
          if (Array.isArray(entries[key])) {
            entries[key].unshift('./src/lib/polyfills.ts');
          } else if (typeof entries[key] === 'string') {
            entries[key] = ['./src/lib/polyfills.ts', entries[key]];
          }
        });

        return entries;
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
