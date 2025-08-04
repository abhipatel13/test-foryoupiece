/**
 * Product Matcher Service
 * Handles matching parsed product names to database products using exact and fuzzy matching
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ParsedProduct } from './stock-message-parser';

export interface ProductMatch {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  matchConfidence: number;
  matchMethod: 'exact' | 'fuzzy' | 'manual';
  parsedProduct: ParsedProduct;
}

export interface ProductMatchResult {
  matches: ProductMatch[];
  unmatched: ParsedProduct[];
  totalProcessed: number;
  exactMatches: number;
  fuzzyMatches: number;
  unmatchedCount: number;
}

/**
 * Product Matcher Class
 */
export class ProductMatcher {
  private supabase = createServiceRoleClient();

  /**
   * Match parsed products to database products (handles duplicates)
   */
  async matchProducts(parsedProducts: ParsedProduct[]): Promise<ProductMatchResult> {
    const result: ProductMatchResult = {
      matches: [],
      unmatched: [],
      totalProcessed: parsedProducts.length,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedCount: 0
    };

    for (const parsedProduct of parsedProducts) {
      try {
        const matches = await this.findProductMatch(parsedProduct);

        if (matches.length > 0) {
          // Add all matches (handles duplicates)
          result.matches.push(...matches);

          // Count match types
          for (const match of matches) {
            if (match.matchMethod === 'exact') {
              result.exactMatches++;
            } else if (match.matchMethod === 'fuzzy') {
              result.fuzzyMatches++;
            }
          }

          console.log(`Found ${matches.length} matches for: ${parsedProduct.extractedName}`);
        } else {
          result.unmatched.push(parsedProduct);
          result.unmatchedCount++;
          console.log(`No matches found for: ${parsedProduct.extractedName}`);
        }
      } catch (error) {
        console.error(`Error matching product: ${parsedProduct.extractedName}`, error);
        result.unmatched.push(parsedProduct);
        result.unmatchedCount++;
      }
    }

    return result;
  }

  /**
   * Find all matches for a single parsed product (handles duplicates)
   */
  private async findProductMatch(parsedProduct: ParsedProduct): Promise<ProductMatch[]> {
    // First try exact matching (returns array for duplicates)
    const exactMatches = await this.findExactMatch(parsedProduct);
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // Then try fuzzy matching
    const fuzzyMatch = await this.findFuzzyMatch(parsedProduct);
    if (fuzzyMatch) {
      return [fuzzyMatch];
    }

    return [];
  }

  /**
   * Find exact match for product name - returns ALL matching products for duplicates
   */
  private async findExactMatch(parsedProduct: ParsedProduct): Promise<ProductMatch[]> {
    const searchName = parsedProduct.extractedName.toLowerCase();
    const matches: ProductMatch[] = [];

    // Try exact name match first (case-insensitive)
    let { data: products, error } = await this.supabase
      .from('products')
      .select('id, name_en, name_ja, sku, stock_quantity')
      .eq('is_active', true)
      .ilike('name_en', searchName);

    if (error) {
      console.error('Error finding exact match:', error);
    }

    // If exact match found, return all matching products
    if (products && products.length > 0) {
      console.log(`Found ${products.length} exact matches for: ${searchName}`);
      return products.map(product => this.createProductMatch(product, parsedProduct, 1.0, 'exact'));
    }

    // Try partial match with contains
    ({ data: products, error } = await this.supabase
      .from('products')
      .select('id, name_en, name_ja, sku, stock_quantity')
      .eq('is_active', true)
      .ilike('name_en', `%${searchName}%`)
      .limit(5)); // Limit to 5 for partial matches

    if (error) {
      console.error('Error finding partial match:', error);
      return [];
    }

    if (products && products.length > 0) {
      console.log(`Found ${products.length} partial matches for: ${searchName}`);
      // For partial matches, calculate similarity and only return good matches
      return products
        .map(product => {
          const similarity = this.calculateSimilarity(searchName, product.name_en.toLowerCase());
          return this.createProductMatch(product, parsedProduct, similarity, 'exact');
        })
        .filter(match => match.matchConfidence >= 0.7); // Only return matches with 70%+ similarity
    }

    return [];
  }

  /**
   * Find fuzzy match for product name using similarity
   */
  private async findFuzzyMatch(parsedProduct: ParsedProduct): Promise<ProductMatch | null> {
    const searchName = parsedProduct.extractedName;

    try {
      // Use the database function for fuzzy matching
      const { data: matches, error } = await this.supabase
        .rpc('find_products_by_name', {
          search_name: searchName,
          exact_match_only: false
        });

      if (error) {
        console.error('Error finding fuzzy match:', error);
        return null;
      }

      if (matches && matches.length > 0) {
        // Get the best match (highest score)
        const bestMatch = matches[0];
        
        // Only accept matches with confidence > 0.6 (60%)
        if (bestMatch.match_score >= 0.6) {
          return this.createProductMatch(bestMatch, parsedProduct, bestMatch.match_score, 'fuzzy');
        }
      }
    } catch (error) {
      console.error('Error in fuzzy matching:', error);
    }

    return null;
  }

  /**
   * Alternative fuzzy matching using JavaScript-based similarity
   * Fallback when database fuzzy matching is not available
   */
  private async findJavaScriptFuzzyMatch(parsedProduct: ParsedProduct): Promise<ProductMatch | null> {
    // Get all active products
    const { data: products, error } = await this.supabase
      .from('products')
      .select('id, name_en, name_ja, sku, stock_quantity')
      .eq('is_active', true);

    if (error || !products) {
      console.error('Error fetching products for fuzzy matching:', error);
      return null;
    }

    const searchName = parsedProduct.extractedName.toLowerCase();
    let bestMatch: any = null;
    let bestScore = 0;

    for (const product of products) {
      // Calculate similarity scores for different fields
      const nameEnScore = this.calculateSimilarity(searchName, product.name_en.toLowerCase());
      const nameJaScore = product.name_ja ? this.calculateSimilarity(searchName, product.name_ja.toLowerCase()) : 0;
      const skuScore = this.calculateSimilarity(searchName, product.sku.toLowerCase());

      const maxScore = Math.max(nameEnScore, nameJaScore, skuScore);

      if (maxScore > bestScore && maxScore >= 0.6) {
        bestScore = maxScore;
        bestMatch = product;
      }
    }

    if (bestMatch) {
      return {
        productId: bestMatch.id,
        productName: bestMatch.name_en,
        sku: bestMatch.sku,
        currentStock: bestMatch.stock_quantity,
        matchConfidence: bestScore,
        matchMethod: 'fuzzy',
        parsedProduct
      };
    }

    return null;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get product suggestions for unmatched items
   */
  async getProductSuggestions(unmatchedName: string, limit: number = 5): Promise<any[]> {
    const { data: products, error } = await this.supabase
      .from('products')
      .select('id, name_en, name_ja, sku, stock_quantity')
      .eq('is_active', true)
      .limit(limit);

    if (error || !products) {
      return [];
    }

    const searchName = unmatchedName.toLowerCase();
    
    return products
      .map(product => ({
        ...product,
        similarity: Math.max(
          this.calculateSimilarity(searchName, product.name_en.toLowerCase()),
          product.name_ja ? this.calculateSimilarity(searchName, product.name_ja.toLowerCase()) : 0,
          this.calculateSimilarity(searchName, product.sku.toLowerCase())
        )
      }))
      .filter(product => product.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Create a ProductMatch object from database result
   */
  private createProductMatch(product: any, parsedProduct: ParsedProduct, confidence: number, method: 'exact' | 'fuzzy'): ProductMatch {
    return {
      productId: product.id,
      productName: product.name_en,
      sku: product.sku,
      currentStock: product.stock_quantity,
      matchConfidence: confidence,
      matchMethod: method,
      parsedProduct
    };
  }

  /**
   * Validate stock update is possible
   */
  validateStockUpdate(match: ProductMatch): { valid: boolean; warning?: string } {
    const newStock = match.currentStock - match.parsedProduct.quantity;

    if (newStock < 0) {
      return {
        valid: true, // Allow negative stock (backorders)
        warning: `Stock will go negative: ${match.currentStock} - ${match.parsedProduct.quantity} = ${newStock}`
      };
    }

    if (newStock === 0) {
      return {
        valid: true,
        warning: `Product will be out of stock after this update`
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const productMatcher = new ProductMatcher();
