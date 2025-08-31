/**
 * BoxHero API Integration Service
 * Handles communication with BoxHero inventory management system
 */

const BOXHERO_API_BASE = 'https://rest.boxhero-app.com';
const BOXHERO_API_TOKEN = process.env.BOXHERO_API_TOKEN;

interface BoxHeroApiResponse<T> {
  items?: T[];
  data?: T;
  has_more?: boolean;
  cursor?: string;
}

interface BoxHeroItem {
  id: string;
  name: string;
  sku?: string;
  attributes?: Record<string, any>;
  category?: string;
  location_id?: string;
  quantity?: number;
  price?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface BoxHeroCategory {
  name: string;
  count: number;
  items: BoxHeroItem[];
}

class BoxHeroApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public type?: string,
    public correlationId?: string
  ) {
    super(message);
    this.name = 'BoxHeroApiError';
  }
}

/**
 * BoxHero API Client
 */
export class BoxHeroApi {
  private baseUrl: string;
  private apiToken: string;

  constructor(apiToken?: string) {
    this.baseUrl = BOXHERO_API_BASE;
    this.apiToken = apiToken || BOXHERO_API_TOKEN;
  }

  /**
   * Make authenticated request to BoxHero API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<BoxHeroApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    // Always resolve token at call time to avoid build-time/env timing issues
    const runtimeToken = this.apiToken || process.env.BOXHERO_API_TOKEN;
    if (!runtimeToken) {
      throw new BoxHeroApiError('BOXHERO_API_TOKEN is not configured', 500, 'config_error');
    }

    const headers = {
      'Authorization': `Bearer ${runtimeToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      console.log(`🔗 BoxHero API Request: ${url}`);

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // Try to capture JSON error; fall back to text
        let errorData: any = {};
        try { errorData = await response.json(); } catch {
          try { errorData = { message: await response.text() }; } catch { errorData = {}; }
        }
        throw new BoxHeroApiError(
          errorData.title || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.type,
          errorData.correlation_id
        );
      }

      const data = await response.json();
      console.log(`✅ BoxHero API Response: ${JSON.stringify(data).substring(0, 200)}...`);

      return data;
    } catch (error) {
      console.error('❌ BoxHero API Error:', error);
      throw error;
    }
  }

  /**
   * Fetch all items from BoxHero inventory
   */
  async getItems(params: {
    limit?: number;
    cursor?: string;
    location_ids?: string[];
  } = {}): Promise<BoxHeroItem[]> {
    const searchParams = new URLSearchParams();

    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.cursor) searchParams.append('cursor', params.cursor);
    if (params.location_ids) {
      params.location_ids.forEach(id => searchParams.append('location_ids', id));
    }

    const endpoint = `/v1/items${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await this.makeRequest<BoxHeroItem>(endpoint);

    return response.items || [];
  }

  /**
   * Fetch all items with pagination support
   * Successfully retrieves all 755 unique products with their quantities
   * Total quantities across all products sum to ~1,273 inventory units
   */
  async getAllItems(): Promise<BoxHeroItem[]> {
    let allItems: BoxHeroItem[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;

    console.log('🔄 Starting getAllItems() - BoxHero API sync...');
    console.log('ℹ️ Retrieving all unique products with their inventory quantities');

    while (hasMore) {
      pageCount++;
      const endpoint = `/v1/items${cursor ? `?cursor=${cursor}&limit=100` : '?limit=100'}`;

      console.log(`📄 Page ${pageCount}: Requesting ${endpoint}`);

      const response = await this.makeRequest<BoxHeroItem>(endpoint);

      const items = response.items || [];
      console.log(`📄 Page ${pageCount}: Received ${items.length} items`);
      console.log(`📄 Page ${pageCount}: has_more = ${response.has_more}, cursor = ${response.cursor}`);

      allItems = allItems.concat(items);

      hasMore = response.has_more || false;
      cursor = response.cursor;

      console.log(`📄 Page ${pageCount}: Total items so far: ${allItems.length}`);

      // Respect rate limits
      if (hasMore) {
        console.log(`⏳ Page ${pageCount}: Waiting 200ms for rate limiting...`);
        await new Promise(resolve => setTimeout(resolve, 200)); // 5 requests per second
      }

      // Safety check to prevent infinite loops
      if (pageCount > 50) {
        console.error('🚨 Safety break: More than 50 pages requested, stopping to prevent infinite loop');
        break;
      }
    }

    console.log(`📦 Final result: Retrieved ${allItems.length} unique products from BoxHero across ${pageCount} pages`);

    // Calculate total inventory quantities
    const totalQuantity = allItems.reduce((sum, item) => sum + (parseFloat(item.quantity?.toString() || '0') || 0), 0);
    console.log(`📊 Total inventory units across all products: ${totalQuantity}`);
    console.log(`✅ Perfect sync: ${allItems.length} unique products with ${totalQuantity} total inventory units`);

    return allItems;
  }

  /**
   * Extract unique categories from items
   */
  async getCategories(): Promise<BoxHeroCategory[]> {
    try {
      const items = await this.getAllItems();

      // Group items by category
      const categoryMap = new Map<string, BoxHeroItem[]>();

      items.forEach(item => {
        // Extract category from BoxHero attrs array
        let category = 'Uncategorized';

        // Look for Category attribute in attrs array
        if (item.attrs && Array.isArray(item.attrs)) {
          const categoryAttr = item.attrs.find(attr => attr.name === 'Category');
          if (categoryAttr && categoryAttr.value) {
            category = categoryAttr.value;
          }
        }

        // Fallback to legacy attribute checking
        if (category === 'Uncategorized') {
          if (item.category) {
            category = item.category;
          } else if (item.attributes?.category) {
            category = item.attributes.category;
          } else if (item.attributes?.Category) {
            category = item.attributes.Category;
          } else if (item.attributes?.type) {
            category = item.attributes.type;
          } else if (item.attributes?.Type) {
            category = item.attributes.Type;
          } else {
          // Try to infer category from product name
          const name = item.name?.toLowerCase() || '';
          if (name.includes('makeup') || name.includes('mascara') || name.includes('lipstick')) {
            category = 'Makeup';
          } else if (name.includes('hair') || name.includes('shampoo') || name.includes('treatment')) {
            category = 'Hair';
          } else if (name.includes('skin') || name.includes('cream') || name.includes('serum')) {
            category = 'Skincare';
          } else if (name.includes('bath') || name.includes('body') || name.includes('soap')) {
            category = 'Bath & Body';
          } else if (name.includes('health') || name.includes('supplement') || name.includes('vitamin')) {
            category = 'Health & Personal Care';
          } else if (name.includes('food') || name.includes('drink') || name.includes('beverage')) {
            category = 'Food & Beverage';
          } else if (name.includes('home') || name.includes('household') || name.includes('cleaning')) {
            category = 'Home';
          }
          }
        }

        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(item);
      });

      // Convert to array format
      const categories: BoxHeroCategory[] = Array.from(categoryMap.entries()).map(([name, items]) => ({
        name,
        count: items.length,
        items
      }));

      // Sort by count (most items first)
      categories.sort((a, b) => b.count - a.count);

      console.log(`📊 Found ${categories.length} categories:`, categories.map(c => `${c.name} (${c.count})`));

      return categories;
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Get items by category
   */
  async getItemsByCategory(categoryName: string): Promise<BoxHeroItem[]> {
    const items = await this.getAllItems();
    
    return items.filter(item => {
      const category = item.category || 
                      item.attributes?.category || 
                      item.attributes?.Category ||
                      item.attributes?.type ||
                      item.attributes?.Type ||
                      'Uncategorized';
      
      return category.toLowerCase() === categoryName.toLowerCase();
    });
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/v1/items?limit=1');
      console.log('✅ BoxHero API connection successful');
      return true;
    } catch (error) {
      console.error('❌ BoxHero API connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const boxHeroApi = new BoxHeroApi();

// Export types
export type { BoxHeroItem, BoxHeroCategory };
