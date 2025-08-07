import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

// SECURITY FIX: Configure specific allowed origins instead of wildcard CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://foryoupiece.com',
  'https://www.foryoupiece.com',
  // Add development origins
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

/**
 * SECURITY: Validate origin and set appropriate CORS headers
 */
function setCorsHeaders(response: NextResponse, request: NextRequest): void {
  const origin = request.headers.get('origin');

  // Check if origin is in allowed list
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback to primary domain for legitimate requests without origin header
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  response.headers.set('Cache-Control', 'public, max-age=900'); // 15 minutes
}

// In-memory cache for random images (15 minute TTL for better performance)
interface CacheEntry {
  data: Record<string, string | null>;
  timestamp: number;
}

let imageCache: CacheEntry | null = null; // Clear cache for testing
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes for image randomization

// Pre-warmed cache - removed external Unsplash URLs to avoid CORS issues
// Categories will use local product images or fallback to emoji display
let preWarmedCache: Record<string, string | null> = {
  'hair': null,
  'bath-body': null,
  'skincare': null,
  'health-personal-care': null,
  'food-beverage': null,
  'makeup': null,
  'home': null
};

/**
 * GET /api/categories/random-images
 * Get random product images for each category (optimized with caching)
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = performance.now();
    console.log('🖼️ Fetching random category images (ultra-fast mode)...');

    // Check for refresh parameter to bypass cache
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (forceRefresh) {
      console.log('🔄 Force refresh requested, clearing image cache...');
      imageCache = null;
    }

    // Check cache first (30-minute TTL for randomization)
    if (imageCache && (Date.now() - imageCache.timestamp) < CACHE_TTL && !forceRefresh) {
      console.log('💾 Serving random category images from cache (30min TTL)');
      const cachedResponse = NextResponse.json({
        success: true,
        images: imageCache.data,
        timestamp: new Date(imageCache.timestamp).toISOString(),
        cached: true,
        performance: {
          loadTime: Math.round(performance.now() - startTime),
          source: 'cache'
        }
      });

      // SECURITY FIX: Use secure CORS headers instead of wildcard
      setCorsHeaders(cachedResponse, request);

      return cachedResponse;
    }

    // Always fetch real product images from database
    console.log('🔄 Fetching real product images from database...');
    const supabase = createServiceRoleClient();

    // Define the categories we want images for
    const categories = [
      'hair',
      'bath-body',
      'skincare',
      'health-personal-care',
      'food-beverage',
      'makeup',
      'home'
    ];

    // FIXED: Use a more reliable query approach
    // First get all categories to map IDs to slugs
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id, slug')
      .in('slug', categories);

    if (categoryError) {
      console.error('❌ Error fetching categories:', categoryError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch categories',
        details: categoryError.message
      }, { status: 500 });
    }

    const categoryMap = new Map(categoryData?.map(cat => [cat.id, cat.slug]) || []);
    const categoryIds = Array.from(categoryMap.keys());

    console.log('🏷️ Category mapping:', Object.fromEntries(categoryMap));

    // OPTIMIZED: Single query to get products from all categories at once
    console.log('🚀 Using optimized single query for all categories...');

    const { data: allProducts, error: productsError } = await supabase
      .from('products')
      .select('images, category_id')
      .eq('is_active', true)
      .in('category_id', categoryIds)
      .not('images', 'is', null)
      .limit(350) // Get enough products to ensure coverage for all categories
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('❌ Error fetching products:', productsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch products',
        details: productsError.message
      }, { status: 500 });
    }

    // Filter out products with empty image arrays and group by category
    const productsByCategory = new Map();

    allProducts?.forEach(product => {
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        const categorySlug = categoryMap.get(product.category_id);
        if (categorySlug) {
          if (!productsByCategory.has(categorySlug)) {
            productsByCategory.set(categorySlug, []);
          }
          const categoryProducts = productsByCategory.get(categorySlug);
          if (categoryProducts.length < 10) { // Limit to 10 products per category
            categoryProducts.push(product);
          }
        }
      }
    });

    // Log results for each category
    for (const [categorySlug, products] of productsByCategory) {
      console.log(`📊 Category ${categorySlug}: Found ${products.length} products with images`);
      if (products.length > 0) {
        const firstProduct = products[0];
        console.log(`🖼️ ${categorySlug} first product:`, {
          hasImages: firstProduct.images && firstProduct.images.length > 0,
          imageCount: firstProduct.images?.length || 0,
          firstImage: firstProduct.images?.[0] || 'No images'
        });
      }
    }

    // Error handling is now done per category in the loop above

    console.log(`📊 Query returned ${allProducts?.length || 0} total products`);

    if (!allProducts || allProducts.length === 0) {
      console.log('⚠️ No products with images found');
      const noImagesResponse = NextResponse.json({
        success: true,
        images: Object.fromEntries(categories.map(cat => [cat, null])),
        timestamp: new Date().toISOString()
      });

      // SECURITY FIX: Use secure CORS headers instead of wildcard
      setCorsHeaders(noImagesResponse, request);

      return noImagesResponse;
    }

    // Build the result object with random images for each category (using optimized data)
    const categoryImages: Record<string, string | null> = {};

    // Select random image for each category using the optimized productsByCategory Map
    for (const category of categories) {
      const categoryProducts = productsByCategory.get(category) || [];

      if (categoryProducts.length > 0) {
        // Get a random product from this category
        const randomProduct = categoryProducts[Math.floor(Math.random() * categoryProducts.length)];
        const randomImage = randomProduct.images?.[0] || null;
        categoryImages[category] = randomImage;
        console.log(`✅ Found image for ${category}: ${randomImage ? 'Yes' : 'No'}`);
      } else {
        categoryImages[category] = null;
        console.log(`❌ No image found for ${category}`);
      }
    }

    // Fallback to placeholder images for categories without real product images
    categories.forEach(categorySlug => {
      if (!categoryImages[categorySlug]) {
        categoryImages[categorySlug] = preWarmedCache[categorySlug] || null;
        console.log(`🔄 Using placeholder image for ${categorySlug} (no product images found)`);
      }
    });

    // Cache the results
    const timestamp = Date.now();
    imageCache = {
      data: categoryImages,
      timestamp
    };

    console.log(`🖼️ Category images result:`, Object.keys(categoryImages).map(cat => `${cat}: ${categoryImages[cat] ? 'Yes' : 'No'}`));
    console.log(`💾 Cached results for ${CACHE_TTL / 1000 / 60} minutes (randomizes every 30min)`);

    const response = NextResponse.json({
      success: true,
      images: categoryImages,
      timestamp: new Date(timestamp).toISOString(),
      cached: false,
      performance: {
        loadTime: Math.round(performance.now() - startTime),
        source: 'database'
      },
      optimization: {
        imageSize: '150x150',
        format: 'webp_fallback',
        compression: 'high'
      }
    });

    // SECURITY FIX: Use secure CORS headers instead of wildcard
    setCorsHeaders(response, request);

    return response;

  } catch (error) {
    console.error('❌ Random category images API error:', error);

    const errorResponse = NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch random category images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );

    // SECURITY FIX: Use secure CORS headers even for error responses
    setCorsHeaders(errorResponse, request);

    return errorResponse;
  }
}

/**
 * OPTIONS /api/categories/random-images
 * Handle CORS preflight requests for browser compatibility
 * SECURITY FIX: Use secure origin validation instead of wildcard CORS
 */
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });

  // SECURITY FIX: Use secure CORS headers for preflight
  const origin = request.headers.get('origin');

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}
