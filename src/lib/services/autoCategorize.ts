import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { BoxHeroService } from '@/infrastructure/services/BoxHeroService'

export interface AutoCategorizeSummary {
  processedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
}

export async function autoCategorizeProducts(params: {
  boxHeroToken: string
  targetSKUs?: string[]
  dryRun?: boolean
}): Promise<{ success: boolean; summary: AutoCategorizeSummary; errors: string[] }>{
  const { boxHeroToken, targetSKUs, dryRun = false } = params
  const supabase = createServiceRoleClient()
  const boxHeroService = new BoxHeroService(boxHeroToken)

  const boxHeroResult = await boxHeroService.getAllItems()
  if (!boxHeroResult.success) {
    return { success: false, summary: { processedCount: 0, updatedCount: 0, skippedCount: 0, errorCount: 1 }, errors: [boxHeroResult.error.message] }
  }

  let boxHeroItems = boxHeroResult.data
  if (targetSKUs && targetSKUs.length > 0) {
    boxHeroItems = boxHeroItems.filter(item => targetSKUs.includes(item.sku))
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug, name_en')

  if (!categories) {
    return { success: false, summary: { processedCount: 0, updatedCount: 0, skippedCount: 0, errorCount: 1 }, errors: ['Failed to fetch categories'] }
  }

  const categoryMap = new Map(categories.map((cat: any) => [cat.slug, cat.id]))

  let processedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0
  const errors: string[] = []

  for (const boxHeroItem of boxHeroItems) {
    try {
      processedCount++
      const attrs = boxHeroItem.attrs || []
      const categoryAttr = attrs.find((attr: any) => (attr.name || '').toLowerCase() === 'category')
      if (!categoryAttr?.value) { skippedCount++; continue }

      const boxheroCategory = categoryAttr.value.toString().toLowerCase()
      let targetCategorySlug: string | null = null
      switch (boxheroCategory) {
        case 'hair': targetCategorySlug = 'hair'; break
        case 'bath & body': targetCategorySlug = 'bath-body'; break
        case 'skincare': targetCategorySlug = 'skincare'; break
        case 'health & personal care': targetCategorySlug = 'health-personal-care'; break
        case 'food & beverage': targetCategorySlug = 'food-beverage'; break
        case 'makeup': targetCategorySlug = 'makeup'; break
        case 'home': targetCategorySlug = 'home'; break
        default:
          skippedCount++
          continue
      }

      const targetCategoryId = categoryMap.get(targetCategorySlug)
      if (!targetCategoryId) {
        errors.push(`Category not found: ${targetCategorySlug} for SKU: ${boxHeroItem.sku}`)
        errorCount++
        continue
      }

      const { data: product } = await supabase
        .from('products')
        .select('id, name_en, category_id')
        .eq('sku', boxHeroItem.sku)
        .eq('is_active', true)
        .single()

      if (!product) { skippedCount++; continue }

      if (product.category_id !== targetCategoryId) {
        if (!dryRun) {
          const { error } = await supabase
            .from('products')
            .update({ category_id: targetCategoryId })
            .eq('id', product.id)
          if (error) {
            errors.push(`Failed to update ${boxHeroItem.sku}: ${error.message}`)
            errorCount++
          } else {
            updatedCount++
          }
        } else {
          updatedCount++
        }
      }
    } catch (e: any) {
      errors.push(`Error processing ${boxHeroItem.sku}: ${e?.message || 'Unknown error'}`)
      errorCount++
    }
  }

  return { success: true, summary: { processedCount, updatedCount, skippedCount, errorCount }, errors: errors.slice(0, 10) }
}
