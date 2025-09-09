"use client"

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductCreatePage() {
  const params = useParams()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    sku: '',
    name_en: '',
    name_ja: '',
    description_en: '',
    description_ja: '',
    short_description_en: '',
    short_description_ja: '',
    price: 0,
    compare_at_price: 0,
    cost_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
    weight_grams: 0,
    brand: '',
    is_active: true,
    is_featured: false,
    is_preorder: false,
    preorder_limit: 0,
    requires_shipping: true,
    is_digital: false,
    track_inventory: true,
    allow_backorder: false,
    seo_title: '',
    seo_description: '',
    is_trending: false,
    is_best_seller: false,
    best_seller_position: 0,
    images: [] as string[],
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'is_best_seller' && value === false) {
        next.best_seller_position = 0
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)

      if (!formData.sku || !formData.name_en) {
        toast.error('SKU and English name are required')
        return
      }
      if (formData.price < 0) {
        toast.error('Price must be positive')
        return
      }
      if (formData.compare_at_price && formData.compare_at_price > 0 && formData.compare_at_price < formData.price) {
        toast.error(`Compare at price ($${formData.compare_at_price}) must be \u2265 regular price ($${formData.price})`)
        return
      }
      if (formData.cost_price && formData.cost_price < 0) {
        toast.error('Cost price must be positive')
        return
      }

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Ensure numbers are numbers
          price: Number(formData.price) || 0,
          compare_at_price: Number(formData.compare_at_price) || 0,
          cost_price: Number(formData.cost_price) || 0,
          stock_quantity: Number(formData.stock_quantity) || 0,
          low_stock_threshold: Number(formData.low_stock_threshold) || 10,
          weight_grams: Number(formData.weight_grams) || 0,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Failed to create product')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to create product')
      }

      toast.success('Product created successfully!')
      // Redirect to the new product's edit page so admin can add images, etc.
      router.push(`/${params.locale}/fyponly-admin/products/${result.data.id}/edit`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create product'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${params.locale}/fyponly-admin/products`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <p className="text-gray-600">Create a manual product (independent from BoxHero)</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saving} className="min-w-[120px]">
          {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : (<><Plus className="h-4 w-4 mr-2" />Create</>)}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Essential product details and identification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" placeholder="Enter product SKU" value={formData.sku} onChange={(e) => handleInputChange('sku', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" placeholder="Enter brand name" value={formData.brand} onChange={(e) => handleInputChange('brand', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_en">Product Name (English) *</Label>
              <Input id="name_en" placeholder="Enter product name in English" value={formData.name_en} onChange={(e) => handleInputChange('name_en', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_ja">Product Name (Japanese)</Label>
              <Input id="name_ja" placeholder="Enter product name in Japanese" value={formData.name_ja} onChange={(e) => handleInputChange('name_ja', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Descriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Descriptions</CardTitle>
            <CardDescription>Product descriptions for different languages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="short_description_en">Short Description (English)</Label>
              <Textarea id="short_description_en" placeholder="Brief product description in English" className="min-h-[80px]" value={formData.short_description_en} onChange={(e) => handleInputChange('short_description_en', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description_en">Full Description (English)</Label>
              <Textarea id="description_en" placeholder="Detailed product description in English" className="min-h-[120px]" value={formData.description_en} onChange={(e) => handleInputChange('description_en', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short_description_ja">Short Description (Japanese)</Label>
              <Textarea id="short_description_ja" placeholder="Brief product description in Japanese" className="min-h-[80px]" value={formData.short_description_ja} onChange={(e) => handleInputChange('short_description_ja', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description_ja">Full Description (Japanese)</Label>
              <Textarea id="description_ja" placeholder="Detailed product description in Japanese" className="min-h-[120px]" value={formData.description_ja} onChange={(e) => handleInputChange('description_ja', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Product pricing and cost information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
                <Input id="price" type="number" step="0.01" placeholder="0.00" value={formData.price} onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="compare_at_price">Compare at Price</Label>
                <Input id="compare_at_price" type="number" step="0.01" placeholder="0.00" value={formData.compare_at_price} onChange={(e) => handleInputChange('compare_at_price', parseFloat(e.target.value) || 0)} />
                <p className="text-sm text-gray-600">Original price for sale comparison</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost_price">Cost Price</Label>
                <Input id="cost_price" type="number" step="0.01" placeholder="0.00" value={formData.cost_price} onChange={(e) => handleInputChange('cost_price', parseFloat(e.target.value) || 0)} />
                <p className="text-sm text-gray-600">Your cost for this product</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Stock management and inventory settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                <Input id="stock_quantity" type="number" placeholder="0" value={formData.stock_quantity} onChange={(e) => handleInputChange('stock_quantity', parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                <Input id="low_stock_threshold" type="number" placeholder="10" value={formData.low_stock_threshold} onChange={(e) => handleInputChange('low_stock_threshold', parseInt(e.target.value) || 10)} />
                <p className="text-sm text-gray-600">Alert when stock falls below this number</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Track Inventory</Label>
                  <p className="text-sm text-gray-600">Monitor stock levels for this product</p>
                </div>
                <Switch checked={formData.track_inventory} onCheckedChange={(v) => handleInputChange('track_inventory', v)} />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Allow Backorder</Label>
                  <p className="text-sm text-gray-600">Allow orders when out of stock</p>
                </div>
                <Switch checked={formData.allow_backorder} onCheckedChange={(v) => handleInputChange('allow_backorder', v)} />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Pre-order</Label>
                  <p className="text-sm text-gray-600">This is a pre-order product</p>
                </div>
                <Switch checked={formData.is_preorder} onCheckedChange={(v) => handleInputChange('is_preorder', v)} />
              </div>
            </div>
            {formData.is_preorder && (
              <div className="space-y-2">
                <Label htmlFor="preorder_limit">Pre-order Limit</Label>
                <Input id="preorder_limit" type="number" placeholder="0" value={formData.preorder_limit} onChange={(e) => handleInputChange('preorder_limit', parseInt(e.target.value) || 0)} />
                <p className="text-sm text-gray-600">Maximum number of pre-orders allowed (0 = unlimited)</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Product Settings</CardTitle>
            <CardDescription>Additional product configuration options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight_grams">Weight (grams)</Label>
                <Input id="weight_grams" type="number" placeholder="0" value={formData.weight_grams} onChange={(e) => handleInputChange('weight_grams', parseInt(e.target.value) || 0)} />
                <p className="text-sm text-gray-600">Product weight for shipping calculations</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Active</Label>
                  <p className="text-sm text-gray-600">Product is available for sale</p>
                </div>
                <Switch checked={formData.is_active} onCheckedChange={(v) => handleInputChange('is_active', v)} />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Featured</Label>
                  <p className="text-sm text-gray-600">Show in featured products</p>
                </div>
                <Switch checked={formData.is_featured} onCheckedChange={(v) => handleInputChange('is_featured', v)} />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Requires Shipping</Label>
                  <p className="text-sm text-gray-600">Physical product needs shipping</p>
                </div>
                <Switch checked={formData.requires_shipping} onCheckedChange={(v) => handleInputChange('requires_shipping', v)} />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Digital Product</Label>
                  <p className="text-sm text-gray-600">This is a digital product</p>
                </div>
                <Switch checked={formData.is_digital} onCheckedChange={(v) => handleInputChange('is_digital', v)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Categorization */}
        <Card>
          <CardHeader>
            <CardTitle>Product Categorization</CardTitle>
            <CardDescription>Mark products as trending or best sellers for special display</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Trending Product</Label>
                    <p className="text-sm text-gray-600">Mark this product as trending</p>
                  </div>
                  <Switch checked={formData.is_trending} onCheckedChange={(v) => handleInputChange('is_trending', v)} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Best Seller</Label>
                    <p className="text-sm text-gray-600">Mark this product as a best seller</p>
                  </div>
                  <Switch checked={formData.is_best_seller} onCheckedChange={(v) => handleInputChange('is_best_seller', v)} />
                </div>
                {formData.is_best_seller && (
                  <div className="space-y-2">
                    <Label htmlFor="best_seller_position">Best Seller Position</Label>
                    <Input id="best_seller_position" type="number" min={1} placeholder="1" value={formData.best_seller_position} onChange={(e) => handleInputChange('best_seller_position', parseInt(e.target.value) || 0)} />
                    <p className="text-sm text-gray-600">Lower numbers appear first (1 = top position)</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEO */}
        <Card>
          <CardHeader>
            <CardTitle>SEO Settings</CardTitle>
            <CardDescription>Search engine optimization settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seo_title">SEO Title</Label>
              <Input id="seo_title" placeholder="SEO optimized title" value={formData.seo_title} onChange={(e) => handleInputChange('seo_title', e.target.value)} />
              <p className="text-sm text-gray-600">Title tag for search engines</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo_description">SEO Description</Label>
              <Textarea id="seo_description" placeholder="SEO optimized description" className="min-h-[80px]" value={formData.seo_description} onChange={(e) => handleInputChange('seo_description', e.target.value)} />
              <p className="text-sm text-gray-600">Meta description for search engines</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" asChild>
            <Link href={`/${params.locale}/fyponly-admin/products`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving} className="min-w-[120px]">
            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : (<><Save className="h-4 w-4 mr-2" />Create Product</>)}
          </Button>
        </div>
      </form>

      {/* Note on Images */}
      <Card>
        <CardHeader>
          <CardTitle>Product Images</CardTitle>
          <CardDescription>After creating the product, you can upload images on the Edit page.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">Images are managed after the product is created (requires a valid SKU). You will be redirected to the Edit page once creation succeeds.</p>
        </CardContent>
      </Card>
    </div>
  )
}

