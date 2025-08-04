import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface BulkUpdateRequest {
  updates: {
    product_id: string
    action: 'promote' | 'demote' | 'add' | 'remove'
    new_position?: number | null
  }[]
  reason?: string
}

export interface BulkUpdateResponse {
  success: boolean
  data: {
    updated_count: number
    failed_count: number
    results: {
      product_id: string
      success: boolean
      error?: string
      old_position?: number | null
      new_position?: number | null
    }[]
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkUpdateRequest = await request.json()
    const { updates, reason = 'Bulk update via analytics recommendations' } = body
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }
    
    const supabase = createServiceRoleClient()

    if (!supabase) {
      console.error('❌ Failed to create service role client for bulk update')
      return NextResponse.json(
        {
          success: false,
          error: 'Service configuration error'
        },
        { status: 500 }
      )
    }
    const results: BulkUpdateResponse['data']['results'] = []
    let updatedCount = 0
    let failedCount = 0
    
    console.log(`🔄 Processing ${updates.length} bulk best seller updates`)
    
    // Process each update
    for (const update of updates) {
      try {
        const { product_id, action, new_position } = update
        
        // Get current product state
        const { data: currentProduct, error: fetchError } = await supabase
          .from('products')
          .select('id, sku, name_en, is_best_seller, best_seller_position')
          .eq('id', product_id)
          .single()
        
        if (fetchError || !currentProduct) {
          results.push({
            product_id,
            success: false,
            error: `Product not found: ${fetchError?.message || 'Unknown error'}`
          })
          failedCount++
          continue
        }
        
        const oldPosition = currentProduct.best_seller_position
        let updateData: any = {}
        
        // Determine update based on action
        switch (action) {
          case 'add':
            updateData = {
              is_best_seller: true,
              best_seller_position: new_position || 999
            }
            break
            
          case 'remove':
            updateData = {
              is_best_seller: false,
              best_seller_position: null
            }
            break
            
          case 'promote':
          case 'demote':
            if (new_position === undefined || new_position === null) {
              results.push({
                product_id,
                success: false,
                error: 'New position required for promote/demote action'
              })
              failedCount++
              continue
            }
            updateData = {
              is_best_seller: true,
              best_seller_position: new_position
            }
            break
            
          default:
            results.push({
              product_id,
              success: false,
              error: `Invalid action: ${action}`
            })
            failedCount++
            continue
        }
        
        // Perform the update
        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', product_id)
        
        if (updateError) {
          results.push({
            product_id,
            success: false,
            error: `Update failed: ${updateError.message}`,
            old_position: oldPosition
          })
          failedCount++
        } else {
          results.push({
            product_id,
            success: true,
            old_position: oldPosition,
            new_position: updateData.best_seller_position
          })
          updatedCount++
          
          console.log(`✅ Updated product ${currentProduct.sku}: ${action} (${oldPosition} → ${updateData.best_seller_position})`)
        }
        
      } catch (error) {
        results.push({
          product_id: update.product_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        failedCount++
      }
    }
    
    // If we have position changes, we need to handle conflicts
    if (updatedCount > 0) {
      try {
        await resolvePositionConflicts(supabase)
        console.log('✅ Position conflicts resolved')
      } catch (error) {
        console.warn('⚠️ Warning: Could not resolve position conflicts:', error)
      }
    }
    
    console.log(`✅ Bulk update completed: ${updatedCount} successful, ${failedCount} failed`)
    
    return NextResponse.json({
      success: true,
      data: {
        updated_count: updatedCount,
        failed_count: failedCount,
        results
      }
    })
    
  } catch (error) {
    console.error('❌ Error in bulk update:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process bulk update'
      },
      { status: 500 }
    )
  }
}

// Helper function to resolve position conflicts
async function resolvePositionConflicts(supabase: any) {
  // Get all best sellers ordered by position
  const { data: bestSellers, error } = await supabase
    .from('products')
    .select('id, best_seller_position')
    .eq('is_best_seller', true)
    .not('best_seller_position', 'is', null)
    .order('best_seller_position', { ascending: true })
  
  if (error || !bestSellers) {
    throw new Error(`Failed to fetch best sellers: ${error?.message}`)
  }
  
  // Check for duplicates and gaps
  const positionMap = new Map<number, string[]>()
  bestSellers.forEach(product => {
    const pos = product.best_seller_position
    if (!positionMap.has(pos)) {
      positionMap.set(pos, [])
    }
    positionMap.get(pos)!.push(product.id)
  })
  
  // Resolve duplicates by reassigning positions sequentially
  let nextPosition = 1
  const updates: { id: string, position: number }[] = []
  
  for (const [position, productIds] of Array.from(positionMap.entries()).sort(([a], [b]) => a - b)) {
    for (const productId of productIds) {
      if (nextPosition !== position || productIds.length > 1) {
        updates.push({ id: productId, position: nextPosition })
      }
      nextPosition++
    }
  }
  
  // Apply position updates
  for (const update of updates) {
    await supabase
      .from('products')
      .update({ best_seller_position: update.position })
      .eq('id', update.id)
  }
  
  console.log(`🔧 Resolved ${updates.length} position conflicts`)
}
