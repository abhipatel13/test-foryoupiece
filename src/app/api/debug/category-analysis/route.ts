import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { CategoriesService } from '@/lib/categories-service';

/**
 * Comprehensive category data analysis API
 * Diagnoses category count accuracy and product categorization issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting comprehensive category analysis...');
    
    const supabase = createServiceRoleClient();
    
    // 1. Get total active products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // 2. Get all categories
    const categories = await CategoriesService.getCategories();
    
    // 3. Count products by category (direct category_id matching)
    const categoryAnalysis = await Promise.all(
      categories.map(async (category) => {
        // Count products with this category_id
        const { count: directCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('category_id', category.id);
        
        // Get sample products from this category
        const { data: sampleProducts } = await supabase
          .from('products')
          .select('id, sku, name_en, tags, category_id')
          .eq('is_active', true)
          .eq('category_id', category.id)
          .limit(5);
        
        return {
          category: {
            id: category.id,
            name: category.name_en,
            slug: category.slug
          },
          directCount,
          sampleProducts: sampleProducts || []
        };
      })
    );
    
    // 4. Count uncategorized products
    const { count: uncategorizedCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('category_id', null);
    
    // 5. Get sample uncategorized products
    const { data: uncategorizedSamples } = await supabase
      .from('products')
      .select('id, sku, name_en, tags, category_id')
      .eq('is_active', true)
      .is('category_id', null)
      .limit(10);
    
    // 6. Calculate totals
    const categorizedTotal = categoryAnalysis.reduce((sum, cat) => sum + (cat.directCount || 0), 0);
    const calculatedTotal = categorizedTotal + (uncategorizedCount || 0);
    
    // 7. Identify potential miscategorizations in Home category
    const homeCategory = categoryAnalysis.find(cat => cat.category.slug === 'home');
    const { data: allHomeProducts } = await supabase
      .from('products')
      .select('id, sku, name_en, tags, category_id')
      .eq('is_active', true)
      .eq('category_id', homeCategory?.category.id || '');
    
    // 8. Analyze Home category products for potential miscategorizations
    const homeMiscategorizations = allHomeProducts?.filter(product => {
      const name = product.name_en.toLowerCase();
      const tags = product.tags?.join(' ').toLowerCase() || '';
      
      // Check if product should be in other categories
      if (name.includes('perfume') || name.includes('parfum') || name.includes('fragrance') || 
          tags.includes('body mist') || tags.includes('fiancée') || tags.includes('aqua savon')) {
        return { ...product, suggestedCategory: 'Bath & Body' };
      }
      
      if (name.includes('oil') && (name.includes('mct') || name.includes('supplement')) ||
          tags.includes('health')) {
        return { ...product, suggestedCategory: 'Health & Personal Care' };
      }
      
      return false;
    }).filter(Boolean);
    
    // 9. Summary
    const analysis = {
      totalActiveProducts: totalProducts,
      categorizedProducts: categorizedTotal,
      uncategorizedProducts: uncategorizedCount,
      calculatedTotal,
      discrepancy: (totalProducts || 0) - calculatedTotal,
      
      categoryBreakdown: categoryAnalysis.map(cat => ({
        category: cat.category.name,
        slug: cat.category.slug,
        count: cat.directCount,
        sampleProducts: cat.sampleProducts.map(p => ({
          name: p.name_en,
          tags: p.tags
        }))
      })),
      
      uncategorizedSamples: uncategorizedSamples?.map(p => ({
        name: p.name_en,
        tags: p.tags
      })) || [],
      
      homeCategoryIssues: {
        totalHomeProducts: homeCategory?.directCount || 0,
        potentialMiscategorizations: homeMiscategorizations?.length || 0,
        miscategorizedProducts: homeMiscategorizations?.map(p => ({
          name: p.name_en,
          tags: p.tags,
          suggestedCategory: p.suggestedCategory
        })) || []
      }
    };
    
    console.log('✅ Category analysis completed');
    
    return NextResponse.json({
      success: true,
      analysis,
      recommendations: [
        'Review Home category products for miscategorizations',
        'Recategorize perfume/fragrance products to Bath & Body',
        'Move health supplements to Health & Personal Care',
        'Ensure counting logic matches filtering logic across APIs'
      ]
    });
    
  } catch (error) {
    console.error('❌ Category analysis error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze category data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
