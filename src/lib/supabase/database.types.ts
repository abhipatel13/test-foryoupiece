export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          user_id: string
          role: string
          permissions: Json
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          permissions?: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          permissions?: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          user_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          variant_id?: string | null
          quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          variant_id?: string | null
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name_en: string
          name_ja: string
          description_en: string | null
          description_ja: string | null
          slug: string
          parent_id: string | null
          image_url: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_en: string
          name_ja: string
          description_en?: string | null
          description_ja?: string | null
          slug: string
          parent_id?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name_en?: string
          name_ja?: string
          description_en?: string | null
          description_ja?: string | null
          slug?: string
          parent_id?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      inventory_movements: {
        Row: {
          id: string
          product_id: string | null
          variant_id: string | null
          movement_type: string
          quantity: number
          reason: string
          reference_type: string | null
          reference_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          variant_id?: string | null
          movement_type: string
          quantity: number
          reason: string
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          variant_id?: string | null
          movement_type?: string
          quantity?: number
          reason?: string
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          variant_id: string | null
          sku: string
          title: string
          variant_title: string | null
          quantity: number
          price: number
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          variant_id?: string | null
          sku: string
          title: string
          variant_title?: string | null
          quantity: number
          price: number
          total: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          variant_id?: string | null
          sku?: string
          title?: string
          variant_title?: string | null
          quantity?: number
          price?: number
          total?: number
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          sku: string
          name_en: string
          name_ja: string
          description_en: string | null
          description_ja: string | null
          short_description_en: string | null
          short_description_ja: string | null
          price: number
          compare_at_price: number | null
          cost_price: number | null
          images: string[]
          category_id: string | null
          brand: string | null
          weight_grams: number | null
          dimensions: Json | null
          is_preorder: boolean
          preorder_date: string | null
          preorder_limit: number | null
          stock_quantity: number
          stock_status: Database['public']['Enums']['stock_status']
          low_stock_threshold: number
          track_inventory: boolean
          allow_backorder: boolean
          requires_shipping: boolean
          is_digital: boolean
          is_active: boolean
          is_featured: boolean
          seo_title: string | null
          seo_description: string | null
          tags: string[]
          vendor: string | null
          boxhero_item_id: string | null
          boxhero_last_sync_at: string | null
          boxhero_sync_status: string | null
          boxhero_locations: Json | null
          sync_source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name_en: string
          name_ja: string
          description_en?: string | null
          description_ja?: string | null
          short_description_en?: string | null
          short_description_ja?: string | null
          price: number
          compare_at_price?: number | null
          cost_price?: number | null
          images?: string[]
          category_id?: string | null
          brand?: string | null
          weight_grams?: number | null
          dimensions?: Json | null
          is_preorder?: boolean
          preorder_date?: string | null
          preorder_limit?: number | null
          stock_quantity?: number
          stock_status?: Database['public']['Enums']['stock_status']
          low_stock_threshold?: number
          track_inventory?: boolean
          allow_backorder?: boolean
          requires_shipping?: boolean
          is_digital?: boolean
          is_active?: boolean
          is_featured?: boolean
          seo_title?: string | null
          seo_description?: string | null
          tags?: string[]
          vendor?: string | null
          boxhero_item_id?: string | null
          boxhero_last_sync_at?: string | null
          boxhero_sync_status?: string | null
          boxhero_locations?: Json | null
          sync_source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name_en?: string
          name_ja?: string
          description_en?: string | null
          description_ja?: string | null
          short_description_en?: string | null
          short_description_ja?: string | null
          price?: number
          compare_at_price?: number | null
          cost_price?: number | null
          images?: string[]
          category_id?: string | null
          brand?: string | null
          weight_grams?: number | null
          dimensions?: Json | null
          is_preorder?: boolean
          preorder_date?: string | null
          preorder_limit?: number | null
          stock_quantity?: number
          stock_status?: Database['public']['Enums']['stock_status']
          low_stock_threshold?: number
          track_inventory?: boolean
          allow_backorder?: boolean
          requires_shipping?: boolean
          is_digital?: boolean
          is_active?: boolean
          is_featured?: boolean
          seo_title?: string | null
          seo_description?: string | null
          tags?: string[]
          vendor?: string | null
          boxhero_item_id?: string | null
          boxhero_last_sync_at?: string | null
          boxhero_sync_status?: string | null
          boxhero_locations?: Json | null
          sync_source?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          telegram_id: number | null
          telegram_username: string | null
          email: string | null
          phone: string | null
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          points_balance: number
          total_points_earned: number
          tier_level: Database['public']['Enums']['user_tier']
          total_spent: number
          total_orders: number
          preferred_language: string
          marketing_consent: boolean
          address_line_1: string | null
          address_line_2: string | null
          aba_bank_name: string | null
          current_rank_achieved_at: string | null
          last_rank_reset: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          telegram_id?: number | null
          telegram_username?: string | null
          email?: string | null
          phone?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          points_balance?: number
          tier_level?: Database['public']['Enums']['user_tier']
          total_spent?: number
          total_orders?: number
          preferred_language?: string
          marketing_consent?: boolean
          address_line_1?: string | null
          address_line_2?: string | null
          aba_bank_name?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          telegram_id?: number | null
          telegram_username?: string | null
          email?: string | null
          phone?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          points_balance?: number
          tier_level?: Database['public']['Enums']['user_tier']
          total_spent?: number
          total_orders?: number
          preferred_language?: string
          marketing_consent?: boolean
          address_line_1?: string | null
          address_line_2?: string | null
          aba_bank_name?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      wishlist_items: {
        Row: {
          id: string
          user_id: string
          product_id: string
          variant_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          variant_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          variant_id?: string | null
          created_at?: string
        }
      }
      boxhero_sync_logs: {
        Row: {
          id: string
          sync_type: string
          status: string
          started_at: string
          completed_at: string | null
          items_processed: number
          items_added: number
          items_updated: number
          items_failed: number
          error_message: string | null
          sync_details: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sync_type: string
          status?: string
          started_at?: string
          completed_at?: string | null
          items_processed?: number
          items_added?: number
          items_updated?: number
          items_failed?: number
          error_message?: string | null
          sync_details?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sync_type?: string
          status?: string
          started_at?: string
          completed_at?: string | null
          items_processed?: number
          items_added?: number
          items_updated?: number
          items_failed?: number
          error_message?: string | null
          sync_details?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      boxhero_sync_errors: {
        Row: {
          id: string
          sync_log_id: string
          boxhero_item_id: string | null
          sku: string | null
          error_type: string
          error_message: string
          error_details: Json
          created_at: string
        }
        Insert: {
          id?: string
          sync_log_id: string
          boxhero_item_id?: string | null
          sku?: string | null
          error_type: string
          error_message: string
          error_details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          sync_log_id?: string
          boxhero_item_id?: string | null
          sku?: string | null
          error_type?: string
          error_message?: string
          error_details?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_points_earned: {
        Args: {
          order_total: number
          user_tier?: Database['public']['Enums']['user_tier']
        }
        Returns: number
      }
      calculate_user_tier: {
        Args: {
          total_spent: number
        }
        Returns: Database['public']['Enums']['user_tier']
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      is_super_admin: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      get_last_successful_sync: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_sync_statistics: {
        Args: {
          days_back?: number
        }
        Returns: {
          total_syncs: number
          successful_syncs: number
          failed_syncs: number
          total_items_processed: number
          total_items_added: number
          total_items_updated: number
          avg_sync_duration: string
        }[]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          read: boolean
          related_order_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: string
          read?: boolean
          related_order_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          read?: boolean
          related_order_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
    Enums: {
      fulfillment_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'on_hold'
      payment_status: 'pending' | 'verified' | 'failed' | 'refunded'
      reference_type: 'order' | 'signup' | 'referral' | 'admin_adjustment'
      stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder'
      transaction_type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'refund'
      user_tier: 'bronze' | 'silver' | 'gold' | 'platinum'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
