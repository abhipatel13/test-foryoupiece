import { Result, DomainError } from '@/shared/types/common';

/**
 * BoxHero API Response Types
 */
export interface BoxHeroItem {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  photo_url?: string;
  cost?: string;
  price?: string;
  attrs?: Array<{
    id: number;
    name: string;
    type: string;
    value: string | number;
  }>;
  quantity: number;
  quantities: Array<{
    location_id: number;
    quantity: number;
  }>;
}

export interface BoxHeroLocation {
  id: number;
  name: string;
  quantity: number;
  memo?: string;
}

export interface BoxHeroCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BoxHeroCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BoxHeroTransaction {
  id: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  item_id: string;
  location_id: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  note?: string;
  reference?: string;
  created_at: string;
  updated_at: string;
}

export interface BoxHeroPaginatedResponse<T> {
  items: T[];
  count: number;
  limit?: number;
  cursor?: number;
  has_more: boolean;
}

export interface BoxHeroSyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsAdded: number;
  itemsUpdated: number;
  errors: string[];
  duration: number;
}

/**
 * BoxHero API Service
 * Handles all interactions with the BoxHero inventory management API
 */
export class BoxHeroService {
  private readonly baseUrl = 'https://rest.boxhero-app.com';
  private readonly apiToken: string;
  private readonly rateLimitDelayMs = 200; // 200ms between requests (5 requests per second)

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Make authenticated API request to BoxHero
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Result<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
          ...options.headers,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('X-Ratelimit-Reset');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.makeRequest<T>(endpoint, options);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new DomainError(
          `BoxHero API Error: ${errorData.title || response.statusText}`,
          'BOXHERO_API_ERROR',
          {
            status: response.status,
            type: errorData.type,
            correlationId: errorData.correlation_id,
            ...errorData
          }
        );
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return {
        success: false,
        error: new DomainError('Failed to make BoxHero API request', 'NETWORK_ERROR', error)
      };
    }
  }

  /**
   * Add delay between requests to respect rate limits
   */
  private async rateLimitDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelayMs));
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<Result<boolean>> {
    const result = await this.makeRequest<BoxHeroPaginatedResponse<BoxHeroItem>>('/v1/items?limit=1');
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: true };
  }

  /**
   * Get all locations
   */
  async getLocations(): Promise<Result<BoxHeroLocation[]>> {
    const result = await this.makeRequest<BoxHeroPaginatedResponse<BoxHeroLocation>>('/v1/locations');

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data.items };
  }

  /**
   * Get all categories from BoxHero API
   */
  async getCategories(): Promise<Result<BoxHeroCategory[]>> {
    try {
      console.log('🏷️ Fetching BoxHero categories...');

      const result = await this.makeRequest<BoxHeroPaginatedResponse<BoxHeroCategory>>('/v1/categories');

      if (!result.success) {
        console.error('❌ BoxHero categories request failed:', result.error);
        return { success: false, error: result.error };
      }

      console.log(`✅ Received ${result.data.items.length} categories`);
      return { success: true, data: result.data.items };
    } catch (error) {
      console.error('🚨 Error in getCategories:', error);
      return {
        success: false,
        error: new DomainError('Failed to fetch categories', 'BOXHERO_CATEGORIES_ERROR', error)
      };
    }
  }

  /**
   * Get all items with pagination support
   * NOTE: Location filtering is currently broken in BoxHero API - ignoring locationIds parameter
   */
  async getAllItems(locationIds?: number[]): Promise<Result<BoxHeroItem[]>> {
    const allItems: BoxHeroItem[] = [];
    let cursor: number | undefined;
    let hasMore = true;

    try {
      console.log('🔄 Fetching BoxHero items...');

      // Log warning about location filtering issue
      if (locationIds && locationIds.length > 0) {
        console.warn('⚠️ Location filtering is currently broken in BoxHero API - ignoring location filters');
        console.warn('⚠️ This is a known issue: API returns same unique products regardless of location_ids parameter');
      }

      while (hasMore) {
        await this.rateLimitDelay();

        const params = new URLSearchParams({
          limit: '100',
        });

        if (cursor) {
          params.append('cursor', cursor.toString());
        }

        // TEMPORARILY DISABLED: Location filtering is broken in BoxHero API
        // All location_ids parameters return identical results (same unique products)
        // if (locationIds && locationIds.length > 0) {
        //   locationIds.forEach(id => params.append('location_ids', id.toString()));
        // }

        console.log(`📡 Making request to: /v1/items?${params.toString()}`);

        const result = await this.makeRequest<BoxHeroPaginatedResponse<BoxHeroItem>>(
          `/v1/items?${params.toString()}`
        );

        if (!result.success) {
          console.error('❌ BoxHero API request failed:', result.error);
          return { success: false, error: result.error };
        }

        console.log(`✅ Received ${result.data.items.length} items, hasMore: ${result.data.has_more}`);

        allItems.push(...result.data.items);
        hasMore = result.data.has_more;
        cursor = result.data.cursor;
      }

      console.log(`✅ Successfully fetched ${allItems.length} items total`);
      console.log(`ℹ️ Retrieved all ${allItems.length} unique products with their quantities`);

      // Calculate total inventory quantities
      const totalQuantity = allItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      console.log(`📊 Total inventory units across all products: ${totalQuantity}`);

      return { success: true, data: allItems };
    } catch (error) {
      console.error('🚨 Error in getAllItems:', error);
      return {
        success: false,
        error: new DomainError('Failed to fetch all items', 'BOXHERO_FETCH_ERROR', error)
      };
    }
  }

  /**
   * Get item by ID
   */
  async getItem(itemId: string): Promise<Result<BoxHeroItem>> {
    const result = await this.makeRequest<BoxHeroItem>(`/v1/items/${itemId}`);
    return result;
  }

  /**
   * Search items by name or SKU
   */
  async searchItems(query: string, locationIds?: string[]): Promise<Result<BoxHeroItem[]>> {
    const params = new URLSearchParams({
      q: query,
      limit: '100',
    });

    if (locationIds && locationIds.length > 0) {
      locationIds.forEach(id => params.append('location_ids', id));
    }

    const result = await this.makeRequest<BoxHeroPaginatedResponse<BoxHeroItem>>(
      `/v1/items/search?${params.toString()}`
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data.data };
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(
    itemId?: string,
    locationId?: string,
    limit = 50
  ): Promise<Result<BoxHeroTransaction[]>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    if (itemId) {
      params.append('item_id', itemId);
    }

    if (locationId) {
      params.append('location_id', locationId);
    }

    const result = await this.makeRequest<BoxHeroPaginatedResponse<BoxHeroTransaction>>(
      `/v1/transactions?${params.toString()}`
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data.data };
  }

  /**
   * Create a new item in BoxHero
   */
  async createItem(itemData: {
    name: string;
    sku?: string;
    barcode?: string;
    description?: string;
    category_id?: string;
    unit_price?: number;
    currency?: string;
    custom_fields?: Record<string, any>;
  }): Promise<Result<BoxHeroItem>> {
    const result = await this.makeRequest<BoxHeroItem>('/v1/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });

    return result;
  }

  /**
   * Update an existing item
   */
  async updateItem(
    itemId: string,
    itemData: Partial<{
      name: string;
      sku?: string;
      barcode?: string;
      description?: string;
      category_id?: string;
      unit_price?: number;
      currency?: string;
      custom_fields?: Record<string, any>;
    }>
  ): Promise<Result<BoxHeroItem>> {
    const result = await this.makeRequest<BoxHeroItem>(`/v1/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(itemData),
    });

    return result;
  }

  /**
   * Adjust item quantity at a location
   */
  async adjustQuantity(
    itemId: string,
    locationId: string,
    quantity: number,
    note?: string
  ): Promise<Result<BoxHeroTransaction>> {
    const result = await this.makeRequest<BoxHeroTransaction>('/v1/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'adjustment',
        item_id: itemId,
        location_id: locationId,
        quantity,
        note,
      }),
    });

    return result;
  }

  /**
   * Record stock movement (in/out)
   */
  async recordStockMovement(
    type: 'in' | 'out',
    itemId: string,
    locationId: string,
    quantity: number,
    unitPrice?: number,
    note?: string,
    reference?: string
  ): Promise<Result<BoxHeroTransaction>> {
    const result = await this.makeRequest<BoxHeroTransaction>('/v1/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type,
        item_id: itemId,
        location_id: locationId,
        quantity,
        unit_price: unitPrice,
        note,
        reference,
      }),
    });

    return result;
  }
}
