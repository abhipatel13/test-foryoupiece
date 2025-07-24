/**
 * Smart Product Recommendation Engine
 * Implements algorithms for trending products, personalized recommendations, and deal prioritization
 */

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
  return products
    .map(product => ({
      ...product,
      trendingScore: calculateTrendingScore(product)
    }))
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
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
  return products
    .map(product => ({
      ...product,
      discountPercentage: getDiscountPercentage(product) || 0
    }))
    .filter(product => product.discountPercentage > 0)
    .sort((a, b) => b.discountPercentage - a.discountPercentage)
    .slice(0, limit);
}

/**
 * Calculate personalization score for a product based on user behavior
 */
export function calculatePersonalizationScore(product: Product, userBehavior: UserBehavior): number {
  let score = 0;
  
  // Category preference
  if (product.category && userBehavior.categoryPreferences[product.category]) {
    score += userBehavior.categoryPreferences[product.category] * 10;
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
 * Get personalized recommendations
 */
export function getPersonalizedRecommendations(
  products: Product[], 
  userBehavior: UserBehavior, 
  limit: number = 6
): Product[] {
  return products
    .map(product => ({
      ...product,
      personalizationScore: calculatePersonalizationScore(product, userBehavior)
    }))
    .sort((a, b) => b.personalizationScore - a.personalizationScore)
    .slice(0, limit);
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
    return products
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);
  }
  
  return products
    .filter(product => userBehavior.viewedProducts.includes(product.id))
    .slice(-limit) // Get most recent
    .reverse();
}

/**
 * Simulate user behavior for demo purposes
 */
export function generateSimulatedUserBehavior(products: Product[]): UserBehavior {
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
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
  static getRecentlyViewedProducts = getRecentlyViewedProducts;
  static generateSimulatedUserBehavior = generateSimulatedUserBehavior;
  static calculateTrendingScore = calculateTrendingScore;
  static getDiscountPercentage = getDiscountPercentage;
}
