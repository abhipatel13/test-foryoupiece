/**
 * Smart Product Recommendation Engine
 * Implements algorithms for trending products, personalized recommendations, and deal prioritization
 */

import { UserBehaviorService, UserBehaviorData } from '@/lib/services/user-behavior-service'
import { sortProductsByStockPriority } from '@/lib/utils'

export interface Product {
  id: string;
  name_en: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  is_featured: boolean;
  category?: string;
  brand?: string;
  images: string[];
  created_at: string;
  view_count?: number;
  purchase_count?: number;
  rating?: number;
  tags?: string[];
  points_rate?: number; // Points rate percentage (e.g., 1.00 = 1%, 2.00 = 2%)
}

export interface UserBehavior {
  userId?: string;
  viewedProducts: string[];
  purchasedProducts: string[];
  cartItems: string[];
  searchHistory: string[];
  categoryPreferences: Record<string, number>;
  brandPreferences: Record<string, number>;
  priceRange: { min: number; max: number };
}

export interface PersonalizedRecommendationOptions {
  userId?: string;
  limit?: number;
  includeDiscounts?: boolean;
  excludePurchased?: boolean;
}

/**
 * Calculate trending score based on recent activity
 */
export function calculateTrendingScore(product: Product): number {
  const now = new Date();
  const createdAt = new Date(product.created_at);
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Base scores
  let score = 0;
  
  // Recent views boost (simulated - in real app would come from analytics)
  const recentViews = product.view_count || Math.floor(Math.random() * 100);
  score += recentViews * 0.3;
  
  // Purchase velocity (simulated)
  const recentPurchases = product.purchase_count || Math.floor(Math.random() * 20);
  score += recentPurchases * 2;
  
  // Recency boost - newer products get higher scores
  if (daysSinceCreated <= 7) {
    score *= 1.5; // 50% boost for products added in last week
  } else if (daysSinceCreated <= 30) {
    score *= 1.2; // 20% boost for products added in last month
  }
  
  // Stock scarcity boost
  if (product.stock_quantity <= 5 && product.stock_quantity > 0) {
    score *= 1.3; // 30% boost for low stock items
  }
  
  // Featured product boost
  if (product.is_featured) {
    score *= 1.4;
  }
  
  // Rating boost (simulated)
  const rating = product.rating || 4.0;
  score *= (rating / 5);
  
  return score;
}

/**
 * Get trending products based on algorithm
 */
export function getTrendingProducts(products: Product[], limit: number = 5): Product[] {
  const trendingProducts = products
    .map(product => ({
      ...product,
      trendingScore: calculateTrendingScore(product)
    }))
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);

  // Apply global stock-priority sorting while preserving trending score ranking
  return sortProductsByStockPriority(trendingProducts, (a, b) => {
    // Secondary sort by trending score (descending)
    return b.trendingScore - a.trendingScore
  });
}

/**
 * Calculate discount percentage
 */
export function getDiscountPercentage(product: Product): number | null {
  if (!product.compare_at_price || product.compare_at_price <= product.price) {
    return null;
  }
  return Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100);
}

/**
 * Get products with best deals
 */
export function getDealsProducts(products: Product[], limit: number = 6): Product[] {
  const dealsProducts = products
    .map(product => ({
      ...product,
      discountPercentage: getDiscountPercentage(product) || 0
    }))
    .filter(product => product.discountPercentage > 0)
    .sort((a, b) => b.discountPercentage - a.discountPercentage)
    .slice(0, limit);

  // Apply global stock-priority sorting while preserving deal ranking
  return sortProductsByStockPriority(dealsProducts, (a, b) => {
    // Secondary sort by discount percentage (descending)
    return b.discountPercentage - a.discountPercentage
  });
}

/**
 * Get enhanced deals and discounts products
 * Currently focuses on products with sale prices (compare_at_price > price)
 * Future enhancement: Add support for products with enhanced loyalty points when points_rate field is added to database
 */
export function getEnhancedDealsProducts(products: Product[], limit: number = 6): Product[] {
  console.log(`🎯 Enhanced Deals: Processing ${products.length} products for deals`);

  const dealsProducts = products
    .map(product => {
      const discountPercentage = getDiscountPercentage(product) || 0;
      const hasDiscount = discountPercentage > 0;

      // For now, only use price discounts since points_rate field doesn't exist in database
      // TODO: Add enhanced points support when points_rate field is added to products table
      const dealScore = hasDiscount ? discountPercentage : 0;

      return {
        ...product,
        discountPercentage,
        hasDiscount,
        dealScore
      };
    })
    .filter(product => product.hasDiscount) // Only include products with price discounts for now
    .sort((a, b) => {
      // Primary sort by discount percentage (descending)
      return b.discountPercentage - a.discountPercentage;
    })
    .slice(0, limit);

  console.log(`🎯 Enhanced Deals: Found ${dealsProducts.length} products with discounts`);

  if (dealsProducts.length > 0) {
    console.log(`🎯 Enhanced Deals: Top deal - ${dealsProducts[0].name_en} with ${dealsProducts[0].discountPercentage.toFixed(1)}% off`);
  }

  // Apply global stock-priority sorting while preserving deal ranking
  return sortProductsByStockPriority(dealsProducts, (a, b) => {
    // Secondary sort by discount percentage (descending)
    return b.discountPercentage - a.discountPercentage;
  });
}

/**
 * Calculate personalization score for a product based on user behavior
 */
export function calculatePersonalizationScore(product: Product, userBehavior: UserBehavior): number {
  let score = 0;
  
  // Category preference
  if (product.category?.name_en && userBehavior.categoryPreferences[product.category.name_en]) {
    score += userBehavior.categoryPreferences[product.category.name_en] * 10;
  }
  
  // Brand preference
  if (product.brand && userBehavior.brandPreferences[product.brand]) {
    score += userBehavior.brandPreferences[product.brand] * 8;
  }
  
  // Price range preference
  const { min, max } = userBehavior.priceRange;
  if (product.price >= min && product.price <= max) {
    score += 15;
  } else {
    // Penalty for being outside preferred price range
    const deviation = Math.min(
      Math.abs(product.price - min),
      Math.abs(product.price - max)
    );
    score -= deviation / 100;
  }
  
  // Similar to viewed products (simplified - would use ML in production)
  const viewedProductsBonus = userBehavior.viewedProducts.length > 0 ? 5 : 0;
  score += viewedProductsBonus;
  
  // Avoid already purchased products
  if (userBehavior.purchasedProducts.includes(product.id)) {
    score -= 50;
  }
  
  // Boost for products in cart (complementary items)
  if (userBehavior.cartItems.length > 0) {
    score += 3; // Simple boost for having items in cart
  }
  
  return Math.max(0, score);
}

/**
 * Enhanced personalization score based on real user purchase history
 */
export function calculateEnhancedPersonalizationScore(product: Product, userBehavior: UserBehaviorData): number {
  let score = 0;

  // Strong category preference boost based on purchase history
  const categoryPreference = userBehavior.categoryPreferences[product.category?.name_en || ''] || 0;
  score += categoryPreference * 15; // Higher weight for purchase-based preferences

  // Brand preference boost based on purchase history
  const brandPreference = userBehavior.brandPreferences[product.brand || ''] || 0;
  score += brandPreference * 12;

  // Price range preference based on actual spending patterns
  const { min, max } = userBehavior.priceRange;
  if (product.price >= min && product.price <= max) {
    score += 20; // Higher boost for price range match
  } else if (product.price < min) {
    // Small penalty for being too cheap (might indicate lower quality)
    score -= (min - product.price) / 100;
  } else {
    // Larger penalty for being too expensive
    score -= (product.price - max) / 50;
  }

  // Discount preference boost
  if (userBehavior.preferredDiscounts && product.compare_at_price && product.compare_at_price > product.price) {
    const discountPercent = ((product.compare_at_price - product.price) / product.compare_at_price) * 100;
    score += discountPercent * 0.5; // Boost based on discount percentage
  }

  // Avoid already purchased products (stronger penalty)
  const alreadyPurchased = userBehavior.purchaseHistory.some(p => p.productId === product.id);
  if (alreadyPurchased) {
    score -= 100; // Strong penalty to avoid recommending same products
  }

  // Boost for complementary products (same category as cart items)
  if (userBehavior.cartItems.length > 0) {
    score += 8; // Higher boost for cart complementarity
  }

  // Stock availability boost
  if (product.stock_quantity > 0) {
    score += 5;
  } else {
    score -= 50; // Strong penalty for out-of-stock items
  }

  // Featured product boost
  if (product.is_featured) {
    score += 3;
  }

  // Enhanced search history relevance boost
  if (userBehavior.searchHistory && userBehavior.searchHistory.length > 0) {
    let searchRelevanceScore = 0;

    // Define these variables outside the loop so they can be used later
    const nameLower = product.name_en?.toLowerCase() || '';
    const brandLower = product.brand?.toLowerCase() || '';
    const categoryLower = product.category?.name_en?.toLowerCase() || '';

    userBehavior.searchHistory.forEach(searchTerm => {
      const searchLower = searchTerm.toLowerCase();
      const descLower = product.description_en?.toLowerCase() || '';

      // Exact matches get highest score
      if (nameLower.includes(searchLower)) searchRelevanceScore += 15; // Increased from 8
      if (brandLower.includes(searchLower)) searchRelevanceScore += 12; // Increased from 6
      if (categoryLower.includes(searchLower)) searchRelevanceScore += 10; // New category matching
      if (descLower.includes(searchLower)) searchRelevanceScore += 8; // Increased from 4

      // Enhanced tag matches
      if (product.tags && Array.isArray(product.tags)) {
        product.tags.forEach((tag: string) => {
          if (tag.toLowerCase().includes(searchLower)) {
            searchRelevanceScore += 10; // Increased from 5
          }
        });
      }

      // Partial word matches for better relevance
      const searchWords = searchLower.split(' ').filter(word => word.length >= 2);
      searchWords.forEach(word => {
        if (nameLower.includes(word)) searchRelevanceScore += 6;
        if (brandLower.includes(word)) searchRelevanceScore += 4;
        if (categoryLower.includes(word)) searchRelevanceScore += 3;
        if (descLower.includes(word)) searchRelevanceScore += 2;

        // Tag word matching
        if (product.tags && Array.isArray(product.tags)) {
          product.tags.forEach((tag: string) => {
            if (tag.toLowerCase().includes(word)) {
              searchRelevanceScore += 4;
            }
          });
        }
      });
    });

    // Apply search relevance with cap for balanced scoring
    score += Math.min(searchRelevanceScore, 60); // Cap at 60 points

    // Bonus for products matching multiple different search terms
    const uniqueSearchTerms = [...new Set(userBehavior.searchHistory.map(term => term.toLowerCase()))];
    if (uniqueSearchTerms.length > 1) {
      let multiTermMatches = 0;
      uniqueSearchTerms.forEach(term => {
        if (nameLower.includes(term) || brandLower.includes(term) || categoryLower.includes(term)) {
          multiTermMatches++;
        }
      });

      if (multiTermMatches > 1) {
        score += multiTermMatches * 3; // Bonus for matching multiple search interests
      }
    }
  }

  // Tag-based scoring for specific user preferences
  if (product.tags && userBehavior.purchaseHistory.length > 0) {
    const userTags = userBehavior.purchaseHistory.flatMap(p => p.tags || []);
    const commonTags = product.tags.filter(tag =>
      userTags.some(userTag =>
        userTag.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(userTag.toLowerCase())
      )
    );
    score += commonTags.length * 2;
  }

  return Math.max(0, score);
}

/**
 * Get personalized recommendations
 */
export function getPersonalizedRecommendations(
  products: Product[],
  userBehavior: UserBehavior,
  limit: number = 6
): Product[] {
  const personalizedProducts = products
    .map(product => ({
      ...product,
      personalizationScore: calculatePersonalizationScore(product, userBehavior)
    }))
    .sort((a, b) => b.personalizationScore - a.personalizationScore)
    .slice(0, limit);

  // Apply global stock-priority sorting while preserving personalization score ranking
  return sortProductsByStockPriority(personalizedProducts, (a, b) => {
    // Secondary sort by personalization score (descending)
    return b.personalizationScore - a.personalizationScore
  });
}

/**
 * Get enhanced personalized recommendations based on real user data
 */
export async function getEnhancedPersonalizedRecommendations(
  products: Product[],
  options: PersonalizedRecommendationOptions = {}
): Promise<Product[]> {
  const { userId, limit = 6, includeDiscounts = false, excludePurchased = true } = options;

  // If no user ID provided, return random in-stock products
  if (!userId) {
    const randomProducts = products
      .filter(product => product.stock_quantity > 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    // Apply global stock-priority sorting to random products
    return sortProductsByStockPriority(randomProducts, (a, b) => {
      // Preserve random order as secondary sort
      return 0
    });
  }

  try {
    const behaviorService = new UserBehaviorService();
    const userBehavior = await behaviorService.analyzeUserBehavior(userId);

    // Enhanced search-based recommendations for users with search history
    if (userBehavior.searchHistory.length > 0) {
      console.log(`🔍 Using enhanced search-based recommendations (${userBehavior.searchHistory.length} search terms)`);

      // Score products based on comprehensive search history analysis
      const searchScoredProducts = products
        .filter(product => product.stock_quantity > 0)
        .map(product => {
          let searchScore = 0;
          let matchedTerms = 0;

          userBehavior.searchHistory.forEach(searchTerm => {
            const searchLower = searchTerm.toLowerCase();
            const nameLower = product.name_en?.toLowerCase() || '';
            const brandLower = product.brand?.toLowerCase() || '';
            const descLower = product.description_en?.toLowerCase() || '';
            const categoryLower = product.category?.name_en?.toLowerCase() || '';
            let termMatched = false;

            // Exact matches get highest score
            if (nameLower.includes(searchLower)) {
              searchScore += 15;
              termMatched = true;
            }
            if (brandLower.includes(searchLower)) {
              searchScore += 12;
              termMatched = true;
            }
            if (categoryLower.includes(searchLower)) {
              searchScore += 10;
              termMatched = true;
            }
            if (descLower.includes(searchLower)) {
              searchScore += 8;
              termMatched = true;
            }

            // Enhanced tag matches
            if (product.tags && Array.isArray(product.tags)) {
              product.tags.forEach((tag: string) => {
                if (tag.toLowerCase().includes(searchLower)) {
                  searchScore += 10;
                  termMatched = true;
                }
              });
            }

            // Partial word matches for better coverage
            const searchWords = searchLower.split(' ').filter(word => word.length >= 2);
            searchWords.forEach(word => {
              if (nameLower.includes(word)) {
                searchScore += 5;
                termMatched = true;
              }
              if (brandLower.includes(word)) {
                searchScore += 4;
                termMatched = true;
              }
              if (categoryLower.includes(word)) {
                searchScore += 3;
                termMatched = true;
              }
            });

            if (termMatched) matchedTerms++;
          });

          // Bonus for products matching multiple search terms
          if (matchedTerms > 1) {
            searchScore += matchedTerms * 5;
          }

          // Additional scoring factors
          if (product.is_featured) searchScore += 3;
          if (product.compare_at_price && product.compare_at_price > product.price) {
            searchScore += 2; // Discount bonus
          }

          return { ...product, searchScore, matchedTerms };
        })
        .filter(product => product.searchScore > 0)
        .sort((a, b) => {
          // Sort by search score first, then by matched terms, then by stock
          if (b.searchScore !== a.searchScore) return b.searchScore - a.searchScore;
          if (b.matchedTerms !== a.matchedTerms) return b.matchedTerms - a.matchedTerms;
          return b.stock_quantity - a.stock_quantity;
        });

      console.log(`📊 Found ${searchScoredProducts.length} search-relevant products`);

      // For users with no purchase history, prioritize search-based results
      if (userBehavior.purchaseHistory.length === 0) {
        if (searchScoredProducts.length >= limit) {
          const searchResults = searchScoredProducts.slice(0, limit);
          // Apply global stock-priority sorting to search results
          return sortProductsByStockPriority(searchResults, (a, b) => {
            // Secondary sort by search score (descending)
            return b.searchScore - a.searchScore
          });
        }

        // Fill remaining slots with popular/featured products
        const remainingProducts = products
          .filter(product =>
            product.stock_quantity > 0 &&
            !searchScoredProducts.find(sp => sp.id === product.id)
          )
          .sort((a, b) => {
            // Prioritize featured products, then by stock quantity
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            return b.stock_quantity - a.stock_quantity;
          })
          .slice(0, limit - searchScoredProducts.length);

        const combinedResults = [...searchScoredProducts, ...remainingProducts];
        // Apply global stock-priority sorting to combined results
        return sortProductsByStockPriority(combinedResults, (a, b) => {
          // Secondary sort: search results first, then featured products
          const aIsSearch = searchScoredProducts.find(sp => sp.id === a.id);
          const bIsSearch = searchScoredProducts.find(sp => sp.id === b.id);
          if (aIsSearch && !bIsSearch) return -1;
          if (!aIsSearch && bIsSearch) return 1;
          return 0;
        });
      }

      // For users with purchase history, blend search and purchase-based recommendations
      console.log('🔄 Blending search history with purchase history for recommendations');
    }

    // If user has no purchase history and no search history, return random in-stock products
    if (userBehavior.purchaseHistory.length === 0) {
      const randomProducts = products
        .filter(product => product.stock_quantity > 0)
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);

      // Apply global stock-priority sorting to random products
      return sortProductsByStockPriority(randomProducts, (a, b) => {
        // Preserve random order as secondary sort
        return 0
      });
    }

    // Filter products based on options
    let filteredProducts = products.filter(product => product.stock_quantity > 0);

    if (excludePurchased) {
      const purchasedProductIds = userBehavior.purchaseHistory.map(p => p.productId);
      filteredProducts = filteredProducts.filter(product =>
        !purchasedProductIds.includes(product.id)
      );
    }

    if (includeDiscounts) {
      // Prioritize products with discounts if user prefers them
      if (userBehavior.preferredDiscounts) {
        filteredProducts = filteredProducts.sort((a, b) => {
          const aDiscount = getDiscountPercentage(a) || 0;
          const bDiscount = getDiscountPercentage(b) || 0;
          return bDiscount - aDiscount;
        });
      }
    }

    // Calculate enhanced personalization scores and sort
    const scoredProducts = filteredProducts
      .map(product => ({
        ...product,
        personalizationScore: calculateEnhancedPersonalizationScore(product, userBehavior)
      }))
      .sort((a, b) => b.personalizationScore - a.personalizationScore)
      .slice(0, limit);

    // Apply global stock-priority sorting while preserving personalization scores
    return sortProductsByStockPriority(scoredProducts, (a, b) => {
      // Secondary sort by personalization score (descending)
      return b.personalizationScore - a.personalizationScore
    });

  } catch (error) {
    console.error('Error getting enhanced personalized recommendations:', error);
    // Fallback to random products
    const fallbackProducts = products
      .filter(product => product.stock_quantity > 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    // Apply global stock-priority sorting to fallback products
    return sortProductsByStockPriority(fallbackProducts, (a, b) => {
      // Preserve random order as secondary sort
      return 0
    });
  }
}

/**
 * Get recently viewed products (simulated for demo)
 */
export function getRecentlyViewedProducts(
  products: Product[],
  userBehavior: UserBehavior,
  limit: number = 5
): Product[] {
  if (!userBehavior.viewedProducts.length) {
    // Return random products if no viewing history
    const randomProducts = products
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    // Apply global stock-priority sorting to random products
    return sortProductsByStockPriority(randomProducts, (a, b) => {
      // Preserve random order as secondary sort
      return 0
    });
  }

  const recentlyViewedProducts = products
    .filter(product => userBehavior.viewedProducts.includes(product.id))
    .slice(-limit) // Get most recent
    .reverse();

  // Apply global stock-priority sorting while preserving viewing order
  return sortProductsByStockPriority(recentlyViewedProducts, (a, b) => {
    // Preserve recently viewed order as secondary sort
    return 0
  });
}

/**
 * Simulate user behavior for demo purposes
 */
export function generateSimulatedUserBehavior(products: Product[]): UserBehavior {
  const categories = [...new Set(products.map(p => p.category?.name_en).filter(Boolean))];
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
  
  // Generate random preferences
  const categoryPreferences: Record<string, number> = {};
  categories.forEach(cat => {
    if (cat && Math.random() > 0.7) { // 30% chance to have preference
      categoryPreferences[cat] = Math.random() * 5 + 1; // 1-6 preference score
    }
  });
  
  const brandPreferences: Record<string, number> = {};
  brands.forEach(brand => {
    if (brand && Math.random() > 0.8) { // 20% chance to have preference
      brandPreferences[brand] = Math.random() * 3 + 1; // 1-4 preference score
    }
  });
  
  // Random price range preference
  const minPrice = Math.floor(Math.random() * 5000) + 1000; // $10-$60
  const maxPrice = minPrice + Math.floor(Math.random() * 10000) + 2000; // +$20-$120
  
  // Random viewed products
  const viewedProducts = products
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 8) + 2) // 2-10 viewed products
    .map(p => p.id);
  
  return {
    viewedProducts,
    purchasedProducts: [],
    cartItems: [],
    searchHistory: [],
    categoryPreferences,
    brandPreferences,
    priceRange: { min: minPrice, max: maxPrice }
  };
}

/**
 * Main recommendation engine that orchestrates all algorithms
 */
export class RecommendationEngine {
  static getTrendingProducts = getTrendingProducts;
  static getDealsProducts = getDealsProducts;
  static getPersonalizedRecommendations = getPersonalizedRecommendations;
  static getEnhancedPersonalizedRecommendations = getEnhancedPersonalizedRecommendations;
  static getRecentlyViewedProducts = getRecentlyViewedProducts;
  static generateSimulatedUserBehavior = generateSimulatedUserBehavior;
  static calculateTrendingScore = calculateTrendingScore;
  static calculateEnhancedPersonalizationScore = calculateEnhancedPersonalizationScore;
  static getDiscountPercentage = getDiscountPercentage;
}
