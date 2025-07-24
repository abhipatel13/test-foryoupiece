export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description_en: string | null
          description_ja: string | null
          id: string
          image_url: string | null
          name_en: string
          name_ja: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          image_url?: string | null
          name_en: string
          name_ja: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          image_url?: string | null
          name_en?: string
          name_ja?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          discount_type: Database['public']['Enums']['coupon_discount_type']
          discount_value: number
          total_usage_limit: number | null
          per_user_usage_limit: number | null
          current_usage_count: number
          allowed_user_ids: Json | null
          minimum_order_amount: number | null
          starts_at: string
          expires_at: string | null
          status: Database['public']['Enums']['coupon_status']
          created_by: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          discount_type: Database['public']['Enums']['coupon_discount_type']
          discount_value: number
          total_usage_limit?: number | null
          per_user_usage_limit?: number | null
          current_usage_count?: number
          allowed_user_ids?: Json | null
          minimum_order_amount?: number | null
          starts_at?: string
          expires_at?: string | null
          status?: Database['public']['Enums']['coupon_status']
          created_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          discount_type?: Database['public']['Enums']['coupon_discount_type']
          discount_value?: number
          total_usage_limit?: number | null
          per_user_usage_limit?: number | null
          current_usage_count?: number
          allowed_user_ids?: Json | null
          minimum_order_amount?: number | null
          starts_at?: string
          expires_at?: string | null
          status?: Database['public']['Enums']['coupon_status']
          created_by?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          id: string
          coupon_id: string
          user_id: string
          order_id: string
          discount_amount: number
          order_total_before_discount: number
          used_at: string
        }
        Insert: {
          id?: string
          coupon_id: string
          user_id: string
          order_id: string
          discount_amount: number
          order_total_before_discount: number
          used_at?: string
        }
        Update: {
          id?: string
          coupon_id?: string
          user_id?: string
          order_id?: string
          discount_amount?: number
          order_total_before_discount?: number
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          id: string
          order_number: string
          user_id: string
          email: string
          phone: string | null
          currency: string
          subtotal: number
          shipping_cost: number
          tax_amount: number
          discount_amount: number
          points_used: number
          points_earned: number
          total_amount: number
          payment_status: Database['public']['Enums']['payment_status']
          fulfillment_status: Database['public']['Enums']['fulfillment_status']
          shipping_address: Json
          billing_address: Json | null
          notes: string | null
          created_at: string
          updated_at: string
          coupon_id: string | null
          coupon_code: string | null
          coupon_discount_amount: number
        }
        Insert: {
          id?: string
          order_number: string
          user_id: string
          email: string
          phone?: string | null
          currency?: string
          subtotal: number
          shipping_cost?: number
          tax_amount?: number
          discount_amount?: number
          points_used?: number
          points_earned?: number
          total_amount: number
          payment_status?: Database['public']['Enums']['payment_status']
          fulfillment_status?: Database['public']['Enums']['fulfillment_status']
          shipping_address: Json
          billing_address?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          coupon_id?: string | null
          coupon_code?: string | null
          coupon_discount_amount?: number
        }
        Update: {
          id?: string
          order_number?: string
          user_id?: string
          email?: string
          phone?: string | null
          currency?: string
          subtotal?: number
          shipping_cost?: number
          tax_amount?: number
          discount_amount?: number
          points_used?: number
          points_earned?: number
          total_amount?: number
          payment_status?: Database['public']['Enums']['payment_status']
          fulfillment_status?: Database['public']['Enums']['fulfillment_status']
          shipping_address?: Json
          billing_address?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          coupon_id?: string | null
          coupon_code?: string | null
          coupon_discount_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          phone: string | null
          full_name: string | null
          avatar_url: string | null
          tier: Database['public']['Enums']['user_tier']
          points_balance: number
          total_points_earned: number
          total_spent: number
          created_at: string
          updated_at: string
          address_line_1: string | null
          address_line_2: string | null
          aba_bank_name: string | null
        }
        Insert: {
          id: string
          email: string
          phone?: string | null
          full_name?: string | null
          avatar_url?: string | null
          tier?: Database['public']['Enums']['user_tier']
          points_balance?: number
          total_points_earned?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
          address_line_1?: string | null
          address_line_2?: string | null
          aba_bank_name?: string | null
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          full_name?: string | null
          avatar_url?: string | null
          tier?: Database['public']['Enums']['user_tier']
          points_balance?: number
          total_points_earned?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
          address_line_1?: string | null
          address_line_2?: string | null
          aba_bank_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      validate_coupon_usage: {
        Args: {
          p_coupon_code: string
          p_user_id: string
          p_order_total: number
        }
        Returns: {
          is_valid: boolean
          error_message: string
          coupon_id: string
          discount_amount: number
        }[]
      }
      apply_coupon_to_order: {
        Args: {
          p_coupon_code: string
          p_user_id: string
          p_order_id: string
          p_order_total: number
        }
        Returns: {
          success: boolean
          error_message: string
          discount_amount: number
        }[]
      }
    }
    Enums: {
      coupon_discount_type: "percentage" | "fixed_amount"
      coupon_status: "active" | "inactive" | "expired"
      fulfillment_status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "on_hold"
      payment_status: "pending" | "verified" | "failed" | "refunded"
      user_tier: "bronze" | "silver" | "gold" | "platinum"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}