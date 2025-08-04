import { NextRequest, NextResponse } from 'next/server';
import { boxHeroApi } from '@/lib/boxhero-api';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Testing BoxHero categories API...');
    
    // Test connection first
    const isConnected = await boxHeroApi.testConnection();
    console.log('🔗 BoxHero connection:', isConnected);
    
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'BoxHero API connection failed',
        debug: {
          connected: false
        }
      });
    }

    // Get categories from BoxHero API
    const categories = await boxHeroApi.getCategories();
    console.log('📊 BoxHero categories received:', categories.length);
    
    // Log each category for debugging
    categories.forEach(cat => {
      console.log(`  - ${cat.name}: ${cat.count} items`);
    });

    return NextResponse.json({
      success: true,
      data: {
        categories,
        count: categories.length
      },
      debug: {
        connected: true,
        categoryCount: categories.length,
        totalItems: categories.reduce((sum, cat) => sum + cat.count, 0),
        firstCategory: categories[0] || null
      }
    });

  } catch (error) {
    console.error('🚨 Debug BoxHero categories error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        connected: false,
        error: error
      }
    }, { status: 500 });
  }
}
