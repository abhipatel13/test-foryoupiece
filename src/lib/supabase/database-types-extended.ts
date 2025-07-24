// Extended database types for remaining tables
// This will be merged with the main database.types.ts

import { Database } from './database.types'

type Json = Database['public']['Tables']['users']['Row']['metadata']

export interface ExtendedTables {
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
      coupon_id: string | null
      coupon_code: string | null
      coupon_discount_amount: number
      points_used: number
      points_earned: number
      total_amount: number
      payment_status: Database['public']['Enums']['payment_status']
      payment_method: string
      payment_reference: string | null
      bank_transfer_proof: string | null
      payment_verified_at: string | null
      payment_verified_by: string | null
      fulfillment_status: Database['public']['Enums']['fulfillment_status']
      shipped_at: string | null
      delivered_at: string | null
      tracking_number: string | null
      shipping_address: Json
      billing_address: Json | null
      notes: string | null
      admin_notes: string | null
      cancelled_at: string | null
      cancelled_reason: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      order_number?: string
      user_id: string
      email: string
      phone?: string | null
      currency?: string
      subtotal: number
      shipping_cost?: number
      tax_amount?: number
      discount_amount?: number
      coupon_id?: string | null
      coupon_code?: string | null
      coupon_discount_amount?: number
      points_used?: number
      points_earned?: number
      total_amount: number
      payment_status?: Database['public']['Enums']['payment_status']
      payment_method?: string
      payment_reference?: string | null
      bank_transfer_proof?: string | null
      payment_verified_at?: string | null
      payment_verified_by?: string | null
      fulfillment_status?: Database['public']['Enums']['fulfillment_status']
      shipped_at?: string | null
      delivered_at?: string | null
      tracking_number?: string | null
      shipping_address: Json
      billing_address?: Json | null
      notes?: string | null
      admin_notes?: string | null
      cancelled_at?: string | null
      cancelled_reason?: string | null
      created_at?: string
      updated_at?: string
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
      coupon_id?: string | null
      coupon_code?: string | null
      coupon_discount_amount?: number
      points_used?: number
      points_earned?: number
      total_amount?: number
      payment_status?: Database['public']['Enums']['payment_status']
      payment_method?: string
      payment_reference?: string | null
      bank_transfer_proof?: string | null
      payment_verified_at?: string | null
      payment_verified_by?: string | null
      fulfillment_status?: Database['public']['Enums']['fulfillment_status']
      shipped_at?: string | null
      delivered_at?: string | null
      tracking_number?: string | null
      shipping_address?: Json
      billing_address?: Json | null
      notes?: string | null
      admin_notes?: string | null
      cancelled_at?: string | null
      cancelled_reason?: string | null
      created_at?: string
      updated_at?: string
    }
  }
  payment_verifications: {
    Row: {
      id: string
      order_id: string
      verification_status: string
      bank_transfer_proof: string | null
      transfer_amount: number | null
      transfer_date: string | null
      transfer_reference: string | null
      verified_by: string | null
      verified_at: string | null
      rejection_reason: string | null
      admin_notes: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      order_id: string
      verification_status?: string
      bank_transfer_proof?: string | null
      transfer_amount?: number | null
      transfer_date?: string | null
      transfer_reference?: string | null
      verified_by?: string | null
      verified_at?: string | null
      rejection_reason?: string | null
      admin_notes?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      order_id?: string
      verification_status?: string
      bank_transfer_proof?: string | null
      transfer_amount?: number | null
      transfer_date?: string | null
      transfer_reference?: string | null
      verified_by?: string | null
      verified_at?: string | null
      rejection_reason?: string | null
      admin_notes?: string | null
      created_at?: string
      updated_at?: string
    }
  }
  point_transactions: {
    Row: {
      id: string
      user_id: string
      points: number
      transaction_type: Database['public']['Enums']['transaction_type']
      reference_type: Database['public']['Enums']['reference_type'] | null
      reference_id: string | null
      description: string | null
      expires_at: string | null
      created_at: string
    }
    Insert: {
      id?: string
      user_id: string
      points: number
      transaction_type: Database['public']['Enums']['transaction_type']
      reference_type?: Database['public']['Enums']['reference_type'] | null
      reference_id?: string | null
      description?: string | null
      expires_at?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      user_id?: string
      points?: number
      transaction_type?: Database['public']['Enums']['transaction_type']
      reference_type?: Database['public']['Enums']['reference_type'] | null
      reference_id?: string | null
      description?: string | null
      expires_at?: string | null
      created_at?: string
    }
  }
  preorder_queue: {
    Row: {
      id: string
      product_id: string
      user_id: string
      variant_id: string | null
      quantity: number
      queue_position: number
      notification_sent: boolean
      fulfilled_at: string | null
      cancelled_at: string | null
      created_at: string
    }
    Insert: {
      id?: string
      product_id: string
      user_id: string
      variant_id?: string | null
      quantity: number
      queue_position: number
      notification_sent?: boolean
      fulfilled_at?: string | null
      cancelled_at?: string | null
      created_at?: string
    }
    Update: {
      id?: string
      product_id?: string
      user_id?: string
      variant_id?: string | null
      quantity?: number
      queue_position?: number
      notification_sent?: boolean
      fulfilled_at?: string | null
      cancelled_at?: string | null
      created_at?: string
    }
  }
}
