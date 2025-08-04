import { NextRequest, NextResponse } from 'next/server';
import { CategoriesService } from '@/lib/categories-service';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { boxHeroApi } from '@/lib/boxhero-api';

/**
 * Get emoji for category name
 */
function getCategoryEmoji(categoryName: string): string {
  const name = categoryName.toLowerCase();
  console.log(`🔍 Checking emoji for: "${categoryName}" (lowercase: "${name}")`);

  if (name.includes('hair')) {
    console.log('✅ Matched hair');
    return '💇';
  }
  if (name.includes('bath') || name.includes('body')) {
    console.log('✅ Matched bath & body');
    return '🛁';
  }
  if (name.includes('skin')) {
    console.log('✅ Matched skincare');
    return '✨';
  }
  if (name.includes('makeup')) {
    console.log('✅ Matched makeup');
    return '💋';
  }
  if (name.includes('health') || name.includes('personal')) {
    console.log('✅ Matched health & personal care');
    return '🏥';
  }
  if (name.includes('food') || name.includes('beverage')) {
    console.log('✅ Matched food & beverage');
    return '🍽️';
  }
  if (name.includes('home')) {
    console.log('✅ Matched home');
    return '🏠';
  }

  console.log('❌ No match, using default');
  return '📦'; // Default emoji
}

/**
 * Map category slugs to search keywords for product filtering
 * This provides fallback filtering for products not properly categorized
 */
function getCategoryKeywords(categorySlug: string): string[] {
  const keywordMap: Record<string, string[]> = {
    'hair': ['hair', 'shampoo', 'conditioner', 'treatment', 'scalp', 'keratin', 'ululis', 'honey', 'lucido'],
    'bath-body': ['bath', 'body', 'soap', 'wash', 'lotion', 'cream', 'dove', 'foam'],
    'skincare': ['skin', 'face', 'serum', 'moisturizer', 'cleanser', 'toner', 'mask', 'elixir', 'biore'],
    'makeup': ['makeup', 'cosmetic', 'foundation', 'lipstick', 'mascara', 'eyeshadow', 'blush'],
    'health-personal-care': ['health', 'supplement', 'vitamin', 'medicine', 'patch', 'eye drops', 'lycee'],
    'food-beverages': ['food', 'drink', 'tea', 'matcha', 'beverage', 'snack'],
    'electronics': ['electronics', 'electronic', 'device', 'gadget', 'tech'],
    'fashion': ['fashion', 'clothing', 'apparel', 'wear', 'style'],
    'home': ['home', 'household', 'cleaning', 'kitchen', 'bathroom']
  };

  return keywordMap[categorySlug] || [];
}

/**
 * GET /api/boxhero/categories
 * Fetch categories from local Supabase database ONLY (no more real-time BoxHero API calls)
 * BoxHero data is synced via manual sync operations only
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📂 Categories API called - fetching from local database ONLY');

    // ALWAYS fetch from local database - no more real-time BoxHero API calls
    console.log('📊 Reading categories from Supabase database...');

    // Fetch categories from local database
    const categories = await CategoriesService.getCategories();

    // Get Supabase client for counting products
    const supabase = createServiceRoleClient();

    // Calculate actual product counts for each category
    const transformedCategories = await Promise.all(
      categories.map(async (category) => {
        // Count products for this category using the same logic as products API
        let query = supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Use both foreign key relationship AND keyword matching for better results
        const categoryKeywords = getCategoryKeywords(category.slug);

        if (categoryKeywords.length > 0) {
          // Create conditions for both category_id and keyword matching
          const keywordConditions = categoryKeywords.map(keyword =>
            `name_en.ilike.%${keyword}%,name_ja.ilike.%${keyword}%,description_en.ilike.%${keyword}%,description_ja.ilike.%${keyword}%`
          ).join(',');

          // Combine category_id filter with keyword matching
          query = query.or(`category_id.eq.${category.id},${keywordConditions}`);
        } else {
          // Fallback to category_id only if no keywords defined
          query = query.eq('category_id', category.id);
        }

        const { count } = await query;

        return {
          name: category.name_en || category.name || 'Unknown Category',
          count: count || 0,
          slug: category.slug,
          emoji: category.emoji || getCategoryEmoji(category.slug)
        };
      })
    );

    // Helper function to get emoji based on category slug
    function getCategoryEmoji(slug: string): string {
      const emojiMap: { [key: string]: string } = {
        'electronics': '📱',
        'hair': '💇',
        'fashion': '👗',
        'bath-body': '🛁',
        'food-beverages': '🍽️',
        'skincare': '✨',
        'beauty-health': '💄',
        'makeup': '💋',
        'health-personal-care': '🏥',
        'home-living': '🏠',
        'home': '🏠',
        'toys-games': '🎮',
        'books-media': '📚',
        'sports-outdoors': '⚽'
      };
      return emojiMap[slug] || '📦';
    }

    // Include all 7 categories for homepage display
    const limitedCategories = transformedCategories.slice(0, 7);

    console.log(`📊 Returning ${limitedCategories.length} categories from local database`);

    const response = NextResponse.json({
      success: true,
      categories: limitedCategories,
      total: limitedCategories.length,
      source: 'supabase_database' // Updated to reflect new sync-based architecture
    });

    // Add CORS headers for browser compatibility
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
    response.headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache

    return response;

  } catch (error) {
    console.error('❌ Categories API error:', error);

    const errorResponse = NextResponse.json(
      {
        error: 'Failed to fetch categories from local database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );

    // Add CORS headers even for error responses
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept');

    return errorResponse;
  }
}

/**
 * OPTIONS /api/boxhero/categories
 * Handle CORS preflight requests for browser compatibility
 */
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });

  // Add CORS headers for preflight
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return response;
}


