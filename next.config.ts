import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

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
  // Conditional webpack configuration (only when not using Turbopack)
  webpack: (config, { dev, isServer }) => {
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

      // Production optimizations - avoid aggressive chunk splitting that can cause SSR issues
      if (!dev) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'async', // Only split async chunks to avoid SSR issues
            cacheGroups: {
              default: false,
              vendors: false,
              // Only split large libraries that are commonly used
              react: {
                name: 'react',
                chunks: 'all',
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              },
            },
          },
        };
      }
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
