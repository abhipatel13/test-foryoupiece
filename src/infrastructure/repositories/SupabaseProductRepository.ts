import { createClient } from '@/lib/supabase/client';
import { Result, ID, PaginatedResult, DomainError } from '@/shared/types/common';
import { PAGINATION } from '@/shared/constants';
import { IProductRepository, ProductQueryParams } from '@/domain/repositories/IProductRepository';
import { Product, ProductProps } from '@/domain/entities/Product';
import { SKU } from '@/domain/value-objects/SKU';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/supabase/database.types';

/**
 * Supabase implementation of IProductRepository
 */
export class SupabaseProductRepository implements IProductRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createClient();
  }

  // Helper method to map database data to ProductProps
  private mapDatabaseToProductProps(dbData: any): ProductProps {
    return {
      ...dbData,
      image_urls: dbData.images || [], // Map images to image_urls
      weight: dbData.weight_grams, // Map weight_grams to weight
    };
  }

  async findById(id: ID): Promise<Result<Product | null>> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null };
        }
        throw new DomainError('Failed to find product by ID', 'DATABASE_ERROR', error);
      }

      if (!data) {
        return { success: true, data: null };
      }

      const product = Product.fromPersistence(this.mapDatabaseToProductProps(data));
      return { success: true, data: product };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error finding product', 'UNKNOWN_ERROR', error) };
    }
  }

  async findBySku(sku: SKU): Promise<Result<Product | null>> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('sku', sku.value)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null };
        }
        throw new DomainError('Failed to find product by SKU', 'DATABASE_ERROR', error);
      }

      if (!data) {
        return { success: true, data: null };
      }

      const product = Product.fromPersistence(this.mapDatabaseToProductProps(data));
      return { success: true, data: product };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error finding product by SKU', 'UNKNOWN_ERROR', error) };
    }
  }

  async findMany(params?: ProductQueryParams): Promise<Result<PaginatedResult<Product>>> {
    try {
      const limit = params?.limit || PAGINATION.DEFAULT_LIMIT;
      const offset = params?.offset || PAGINATION.DEFAULT_OFFSET;

      let query = this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `, { count: 'exact' });

      // Apply filters
      if (params?.filters) {
        const filters = params.filters;
        
        if (filters.categoryId) {
          query = query.eq('category_id', filters.categoryId);
        }
        
        if (filters.isFeatured !== undefined) {
          query = query.eq('is_featured', filters.isFeatured);
        }
        
        if (filters.isActive !== undefined) {
          query = query.eq('is_active', filters.isActive);
        }
        
        if (filters.isInStock) {
          query = query.gt('stock_quantity', 0);
        }
        
        if (filters.priceMin !== undefined) {
          query = query.gte('price', filters.priceMin);
        }
        
        if (filters.priceMax !== undefined) {
          query = query.lte('price', filters.priceMax);
        }
        
        if (filters.searchQuery) {
          query = query.or(`name_en.ilike.%${filters.searchQuery}%,name_ja.ilike.%${filters.searchQuery}%,description_en.ilike.%${filters.searchQuery}%,sku.ilike.%${filters.searchQuery}%`);
        }
      }

      // Apply sorting
      if (params?.sort) {
        query = query.order(params.sort.field, { ascending: params.sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new DomainError('Failed to find products', 'DATABASE_ERROR', error);
      }

      const products = (data || []).map(item => Product.fromPersistence(this.mapDatabaseToProductProps(item)));
      const total = count || 0;
      const hasMore = offset + limit < total;

      return {
        success: true,
        data: {
          data: products,
          total,
          hasMore,
        },
      };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error finding products', 'UNKNOWN_ERROR', error) };
    }
  }

  async search(query: string, limit = 20): Promise<Result<Product[]>> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .or(`name_en.ilike.%${query}%,name_ja.ilike.%${query}%,description_en.ilike.%${query}%,description_ja.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(limit);

      if (error) {
        throw new DomainError('Failed to search products', 'DATABASE_ERROR', error);
      }

      const products = (data || []).map(item => Product.fromPersistence(this.mapDatabaseToProductProps(item)));
      return { success: true, data: products };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error searching products', 'UNKNOWN_ERROR', error) };
    }
  }

  async getFeatured(limit = 10): Promise<Result<Product[]>> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('is_featured', true)
        .eq('is_active', true)
        .limit(limit);

      if (error) {
        throw new DomainError('Failed to get featured products', 'DATABASE_ERROR', error);
      }

      const products = (data || []).map(item => Product.fromPersistence(this.mapDatabaseToProductProps(item)));
      return { success: true, data: products };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error getting featured products', 'UNKNOWN_ERROR', error) };
    }
  }

  async findByCategory(categoryId: ID, params?: any): Promise<Result<PaginatedResult<Product>>> {
    return this.findMany({
      ...params,
      filters: {
        ...params?.filters,
        categoryId,
        isActive: true,
      },
    });
  }

  async getLowStock(limit = 20): Promise<Result<Product[]>> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .lte('stock_quantity', 'low_stock_threshold')
        .eq('is_active', true)
        .limit(limit);

      if (error) {
        throw new DomainError('Failed to get low stock products', 'DATABASE_ERROR', error);
      }

      const products = (data || []).map(item => Product.fromPersistence(this.mapDatabaseToProductProps(item)));
      return { success: true, data: products };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error getting low stock products', 'UNKNOWN_ERROR', error) };
    }
  }

  async create(product: Product): Promise<Result<Product>> {
    try {
      const productData = product.toDatabaseObject();
      console.log('🔍 Product data being sent to database:', JSON.stringify(productData, null, 2));
      const { data, error } = await this.supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.log('🔍 Database error details:', JSON.stringify(error, null, 2));
        throw new DomainError('Failed to create product', 'DATABASE_ERROR', error);
      }

      const createdProduct = Product.fromPersistence(this.mapDatabaseToProductProps(data));
      return { success: true, data: createdProduct };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error creating product', 'UNKNOWN_ERROR', error) };
    }
  }

  async update(product: Product): Promise<Result<Product>> {
    try {
      const productData = product.toDatabaseObject();
      const { data, error } = await this.supabase
        .from('products')
        .update(productData)
        .eq('id', product.id)
        .select()
        .single();

      if (error) {
        throw new DomainError('Failed to update product', 'DATABASE_ERROR', error);
      }

      const updatedProduct = Product.fromPersistence(this.mapDatabaseToProductProps(data));
      return { success: true, data: updatedProduct };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error updating product', 'UNKNOWN_ERROR', error) };
    }
  }

  async delete(id: ID): Promise<Result<void>> {
    try {
      // Soft delete by setting is_active to false
      const { error } = await this.supabase
        .from('products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new DomainError('Failed to delete product', 'DATABASE_ERROR', error);
      }

      return { success: true, data: undefined };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error deleting product', 'UNKNOWN_ERROR', error) };
    }
  }

  async existsBySku(sku: SKU): Promise<Result<boolean>> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('id')
        .eq('sku', sku.value)
        .limit(1);

      if (error) {
        throw new DomainError('Failed to check if product exists', 'DATABASE_ERROR', error);
      }

      return { success: true, data: (data?.length || 0) > 0 };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error checking product existence', 'UNKNOWN_ERROR', error) };
    }
  }

  async updateStock(id: ID, quantity: number): Promise<Result<void>> {
    try {
      const { error } = await this.supabase
        .from('products')
        .update({ 
          stock_quantity: quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new DomainError('Failed to update stock', 'DATABASE_ERROR', error);
      }

      return { success: true, data: undefined };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error updating stock', 'UNKNOWN_ERROR', error) };
    }
  }

  async bulkUpdateStock(updates: Array<{ id: ID; quantity: number }>): Promise<Result<void>> {
    try {
      // Use Supabase RPC for bulk update or individual updates in transaction
      const promises = updates.map(update => 
        this.supabase
          .from('products')
          .update({ 
            stock_quantity: update.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id)
      );

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.error) {
          throw new DomainError('Failed to bulk update stock', 'DATABASE_ERROR', result.error);
        }
      }

      return { success: true, data: undefined };
    } catch (error) {
      if (error instanceof DomainError) {
        return { success: false, error };
      }
      return { success: false, error: new DomainError('Unexpected error bulk updating stock', 'UNKNOWN_ERROR', error) };
    }
  }
}
