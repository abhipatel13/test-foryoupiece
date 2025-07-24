/**
 * Categories Service - Local Data Management
 * Handles category data from local database instead of real-time BoxHero API calls
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for database operations
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

export interface Category {
  id: string;
  name_en: string;
  name_ja: string;
  slug: string;
  description_en?: string;
  description_ja?: string;
  parent_id?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// BoxHero-compatible interface for sync operations
export interface BoxHeroCategory {
  id: string;
  name: string;
  slug: string;
  emoji?: string;
  item_count?: number;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  sync_type: string;
  status: 'started' | 'completed' | 'failed';
  categories_synced: number;
  total_items_processed: number;
  error_message?: string;
  sync_duration_ms?: number;
  triggered_by?: string;
  created_at: string;
}

/**
 * Categories Service Class
 */
export class CategoriesService {
  /**
   * Get all active categories from local database
   */
  static async getCategories(): Promise<Category[]> {
    try {
      console.log('📂 Fetching categories from local database...');
      
      const { data, error } = await supabaseService
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('❌ Error fetching categories:', error);
        throw error;
      }

      console.log(`✅ Retrieved ${data?.length || 0} categories from local database`);
      return data || [];
    } catch (error) {
      console.error('❌ Categories service error:', error);
      throw error;
    }
  }

  /**
   * Get category by slug from local database
   */
  static async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      console.log(`🔍 Fetching category by slug: ${slug}`);
      
      const { data, error } = await supabaseService
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error fetching category by slug:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('❌ Error in getCategoryBySlug:', error);
      return null;
    }
  }

  /**
   * Update or insert categories in local database
   */
  static async upsertCategories(categories: Omit<Category, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    try {
      console.log(`💾 Upserting ${categories.length} categories to local database...`);

      const { error } = await supabaseService
        .from('categories')
        .upsert(categories, {
          onConflict: 'slug',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Error upserting categories:', error);
        throw error;
      }

      console.log('✅ Categories upserted successfully');
    } catch (error) {
      console.error('❌ Error in upsertCategories:', error);
      throw error;
    }
  }

  /**
   * Update or insert BoxHero categories (with schema transformation)
   */
  static async upsertBoxHeroCategories(boxHeroCategories: { name: string; slug: string; description?: string; item_count?: number; sort_order: number }[]): Promise<void> {
    try {
      console.log(`💾 Upserting ${boxHeroCategories.length} BoxHero categories to local database...`);

      // Transform BoxHero categories to match the current schema
      const categories = boxHeroCategories.map(cat => ({
        name_en: cat.name,
        name_ja: cat.name, // Use same name for both languages for BoxHero categories
        slug: cat.slug,
        description_en: cat.description || `${cat.name} products from BoxHero inventory`,
        description_ja: cat.description || `${cat.name} products from BoxHero inventory`,
        parent_id: null,
        image_url: null,
        is_active: true,
        sort_order: cat.sort_order
      }));

      const { error } = await supabaseService
        .from('categories')
        .upsert(categories, {
          onConflict: 'slug',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Error upserting BoxHero categories:', error);
        throw error;
      }

      console.log('✅ BoxHero categories upserted successfully');
    } catch (error) {
      console.error('❌ Error in upsertBoxHeroCategories:', error);
      throw error;
    }
  }

  /**
   * Create a sync log entry
   */
  static async createSyncLog(logData: Omit<SyncLog, 'id' | 'created_at'>): Promise<string> {
    try {
      const { data, error } = await supabaseService
        .from('sync_logs')
        .insert(logData)
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error creating sync log:', error);
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('❌ Error in createSyncLog:', error);
      throw error;
    }
  }

  /**
   * Update a sync log entry
   */
  static async updateSyncLog(id: string, updates: Partial<Omit<SyncLog, 'id' | 'created_at'>>): Promise<void> {
    try {
      const { error } = await supabaseService
        .from('sync_logs')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('❌ Error updating sync log:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Error in updateSyncLog:', error);
      throw error;
    }
  }

  /**
   * Get recent sync logs
   */
  static async getSyncLogs(limit: number = 10): Promise<SyncLog[]> {
    try {
      const { data, error } = await supabaseService
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching sync logs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error in getSyncLogs:', error);
      return [];
    }
  }

  /**
   * Get the last successful sync
   */
  static async getLastSuccessfulSync(): Promise<SyncLog | null> {
    try {
      const { data, error } = await supabaseService
        .from('sync_logs')
        .select('*')
        .eq('status', 'completed')
        .eq('sync_type', 'boxhero_categories')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching last successful sync:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('❌ Error in getLastSuccessfulSync:', error);
      return null;
    }
  }

  /**
   * Clear BoxHero categories only (safe method that handles foreign key constraints)
   */
  static async clearBoxHeroCategories(): Promise<void> {
    try {
      console.log('🗑️ Deactivating existing BoxHero-synced categories...');

      // Get all current categories to see what we're working with
      const { data: currentCategories, error: fetchError } = await supabaseService
        .from('categories')
        .select('id, name_en, name_ja, slug, is_active')
        .eq('is_active', true);

      if (fetchError) {
        console.error('❌ Error fetching current categories:', fetchError);
        throw fetchError;
      }

      console.log(`📊 Found ${currentCategories?.length || 0} active categories to evaluate`);

      // Deactivate all active categories - we'll reactivate the ones that should exist
      const { error } = await supabaseService
        .from('categories')
        .update({ is_active: false })
        .eq('is_active', true);

      if (error) {
        console.error('❌ Error deactivating categories:', error);
        throw error;
      }

      console.log('✅ All categories deactivated successfully - ready for fresh sync');
    } catch (error) {
      console.error('❌ Error in clearBoxHeroCategories:', error);
      throw error;
    }
  }

  /**
   * Clear all categories (for fresh sync) - DEPRECATED: Use clearBoxHeroCategories instead
   */
  static async clearCategories(): Promise<void> {
    // Use the safer method instead
    return this.clearBoxHeroCategories();
  }
}
