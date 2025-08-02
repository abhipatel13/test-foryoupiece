import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface CartStockValidationItem {
  id: string
  variant?: string
  quantity: number
}

export interface StockValidationResult {
  id: string
  variant?: string
  currentStock: number
  requestedQuantity: number
  isAvailable: boolean
  maxAvailable: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'insufficient_stock'
  message: string
}

export interface CartStockValidationResponse {
  success: boolean
  results: StockValidationResult[]
  hasOutOfStock: boolean
  hasInsufficientStock: boolean
  canProceedToCheckout: boolean
  message?: string
}

/**
 * POST /api/cart/validate-stock
 * Validate current stock levels for cart items
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items }: { items: CartStockValidationItem[] } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No items provided for validation'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const results: StockValidationResult[] = []
    let hasOutOfStock = false
    let hasInsufficientStock = false

    // Get current stock for all products in the cart
    const productIds = items.map(item => item.id)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, stock_quantity, name_en')
      .in('id', productIds)

    if (error) {
      console.error('❌ Error fetching product stock:', error)
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch current stock information'
      }, { status: 500 })
    }

    // Create a map for quick lookup
    const productStockMap = new Map(
      products.map(product => [product.id, product])
    )

    // Validate each cart item
    for (const item of items) {
      const product = productStockMap.get(item.id)
      
      if (!product) {
        results.push({
          id: item.id,
          variant: item.variant,
          currentStock: 0,
          requestedQuantity: item.quantity,
          isAvailable: false,
          maxAvailable: 0,
          status: 'out_of_stock',
          message: 'Product not found'
        })
        hasOutOfStock = true
        continue
      }

      const currentStock = product.stock_quantity || 0
      const requestedQuantity = item.quantity
      const isAvailable = currentStock >= requestedQuantity
      const maxAvailable = Math.max(0, currentStock)

      let status: StockValidationResult['status']
      let message: string

      if (currentStock <= 0) {
        status = 'out_of_stock'
        message = 'Out of stock'
        hasOutOfStock = true
      } else if (requestedQuantity > currentStock) {
        status = 'insufficient_stock'
        message = currentStock === 1 
          ? 'Only 1 left in stock' 
          : `Only ${currentStock} left in stock`
        hasInsufficientStock = true
      } else if (currentStock <= 5) {
        status = 'low_stock'
        message = currentStock === 1 
          ? 'Only 1 left in stock' 
          : `Only ${currentStock} left in stock`
      } else {
        status = 'in_stock'
        message = 'In stock'
      }

      results.push({
        id: item.id,
        variant: item.variant,
        currentStock,
        requestedQuantity,
        isAvailable,
        maxAvailable,
        status,
        message
      })
    }

    const canProceedToCheckout = !hasOutOfStock && !hasInsufficientStock

    console.log('📦 Stock validation completed:', {
      itemCount: items.length,
      hasOutOfStock,
      hasInsufficientStock,
      canProceedToCheckout
    })

    return NextResponse.json({
      success: true,
      results,
      hasOutOfStock,
      hasInsufficientStock,
      canProceedToCheckout,
      message: canProceedToCheckout 
        ? 'All items are available' 
        : 'Some items have stock issues'
    })

  } catch (error) {
    console.error('❌ Error validating cart stock:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/cart/validate-stock
 * Get stock validation for a single product (for quick checks)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const quantity = parseInt(searchParams.get('quantity') || '1')

    if (!productId) {
      return NextResponse.json({
        success: false,
        message: 'Product ID is required'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: product, error } = await supabase
      .from('products')
      .select('id, stock_quantity, name_en')
      .eq('id', productId)
      .single()

    if (error || !product) {
      return NextResponse.json({
        success: false,
        message: 'Product not found'
      }, { status: 404 })
    }

    const currentStock = product.stock_quantity || 0
    const isAvailable = currentStock >= quantity
    const maxAvailable = Math.max(0, currentStock)

    let status: StockValidationResult['status']
    let message: string

    if (currentStock <= 0) {
      status = 'out_of_stock'
      message = 'Out of stock'
    } else if (quantity > currentStock) {
      status = 'insufficient_stock'
      message = currentStock === 1 
        ? 'Only 1 left in stock' 
        : `Only ${currentStock} left in stock`
    } else if (currentStock <= 5) {
      status = 'low_stock'
      message = currentStock === 1 
        ? 'Only 1 left in stock' 
        : `Only ${currentStock} left in stock`
    } else {
      status = 'in_stock'
      message = 'In stock'
    }

    const result: StockValidationResult = {
      id: productId,
      currentStock,
      requestedQuantity: quantity,
      isAvailable,
      maxAvailable,
      status,
      message
    }

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('❌ Error validating product stock:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 })
  }
}
