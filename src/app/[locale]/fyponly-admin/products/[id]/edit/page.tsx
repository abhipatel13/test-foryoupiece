'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2, Trash2, Play } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ProductImagesDisplay } from '@/components/admin/product-images-display'
import { ProductMediaOrder } from '@/components/admin/product-media-order'

interface Product {
  id: string
  sku: string
  name_en: string
  name_ja?: string
  description_en?: string
  description_ja?: string
  short_description_en?: string
  short_description_ja?: string
  price: number
  compare_at_price?: number
  cost_price?: number
  stock_quantity: number
  low_stock_threshold: number
  weight_grams?: number
  brand?: string
  is_active: boolean
  is_featured: boolean
  is_preorder: boolean
  preorder_limit?: number
  requires_shipping: boolean
  is_digital: boolean
  track_inventory: boolean
  allow_backorder: boolean
  seo_title?: string
  seo_description?: string
  is_trending: boolean
  is_best_seller: boolean
  trending_position?: number
  best_seller_position?: number
  images: string[]
  videos?: string[]
  media_order?: string[]
  created_at: string
  updated_at: string
}

export default function ProductEditPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')


  // Form state
  const [categories, setCategories] = useState<{ id: string; name_en: string; slug: string }[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [formData, setFormData] = useState<{
    sku: string
    name_en: string
    name_ja: string
    description_en: string
    description_ja: string
    short_description_en: string
    short_description_ja: string
    price: number
    compare_at_price: number
    cost_price: number
    stock_quantity: number
    low_stock_threshold: number
    weight_grams: number
    brand: string
    category_id: string
    is_active: boolean
    is_featured: boolean
    is_preorder: boolean
    preorder_limit: number
    requires_shipping: boolean
    is_digital: boolean
    track_inventory: boolean
    allow_backorder: boolean
    seo_title: string
    seo_description: string
    is_trending: boolean
    is_best_seller: boolean
    best_seller_position: number
    images: string[]
    videos: string[]
    media_order: string[]
  }>({
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
    category_id: '',
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
    images: [],
    videos: [],
    media_order: [],
  })

  // Load product data - PHASE 1 FIX: Force fresh load on page navigation
  useEffect(() => {
    if (params?.id) {
      console.log('🔄 Page loaded - forcing fresh product data fetch')
      loadProduct(params.id as string, true) // Force refresh on page load
    }
  }, [params?.id])

  // Load categories for selection
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true)
        const res = await fetch('/api/admin/categories', { cache: 'no-store' })
        const json = await res.json()
        if (json?.success) {
          setCategories(json.data || [])
        } else {
          setCategories([])
        }
      } catch (e) {
        console.error('Failed to load categories', e)
        setCategories([])
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadCategories()
  }, [])

  // PHASE 1 FIX: Cleanup form state when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up form state on component unmount')
      setFormData({
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
        category_id: '',
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
        images: [],
        videos: [],
        media_order: [],
      })
      setProduct(null)
    }
  }, [])

  const loadProduct = async (productId: string, forceRefresh = false) => {
    try {
      setLoading(true)

      // PHASE 1 FIX: Add cache-busting parameter to force fresh database fetch
      const cacheBuster = forceRefresh ? `?timestamp=${Date.now()}&refresh=true` : `?timestamp=${Date.now()}`
      const response = await fetch(`/api/admin/products/${productId}${cacheBuster}`)

      console.log('🔄 Loading product with cache-busting:', {
        productId,
        forceRefresh,
        url: `/api/admin/products/${productId}${cacheBuster}`,
        timestamp: new Date().toISOString()
      })

      if (!response.ok) {
        throw new Error('Failed to load product')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load product')
      }

      const productData = result.data
      setProduct(productData)

      console.log('✅ Product loaded successfully:', {
        productId,
        price: productData.price,
        is_best_seller: productData.is_best_seller,
        best_seller_position: productData.best_seller_position,
        is_trending: productData.is_trending,
        trending_position: productData.trending_position
      })

      // Set form data with product data
      setFormData({
        sku: productData.sku || '',
        name_en: productData.name_en || '',
        name_ja: productData.name_ja || '',
        description_en: productData.description_en || '',
        description_ja: productData.description_ja || '',
        short_description_en: productData.short_description_en || '',
        short_description_ja: productData.short_description_ja || '',
        price: productData.price || 0,
        compare_at_price: productData.compare_at_price || 0,
        cost_price: productData.cost_price || 0,
        stock_quantity: productData.stock_quantity || 0,
        low_stock_threshold: productData.low_stock_threshold || 10,
        weight_grams: productData.weight_grams || 0,
        brand: productData.brand || '',
        category_id: productData.category_id || '',
        is_active: productData.is_active ?? true,
        is_featured: productData.is_featured ?? false,
        is_preorder: productData.is_preorder ?? false,
        preorder_limit: productData.preorder_limit || 0,
        requires_shipping: productData.requires_shipping ?? true,
        is_digital: productData.is_digital ?? false,
        track_inventory: productData.track_inventory ?? true,
        allow_backorder: productData.allow_backorder ?? false,
        seo_title: productData.seo_title || '',
        seo_description: productData.seo_description || '',
        is_trending: productData.is_trending ?? false,
        is_best_seller: productData.is_best_seller ?? false,
        best_seller_position: productData.best_seller_position || 0,
        images: productData.images || [],
        videos: productData.videos || [],
        media_order: productData.media_order || [],
      })
    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSaving(true)

      // Basic validation
      if (!formData.sku || !formData.name_en) {
        toast.error('SKU and English name are required')
        return
      }

      if (formData.price < 0) {
        toast.error('Price must be positive')
        return
      }

      // Validate compare_at_price constraint
      if (formData.compare_at_price && formData.compare_at_price > 0 && formData.compare_at_price < formData.price) {
        toast.error(`Compare at price ($${formData.compare_at_price}) must be greater than or equal to the regular price ($${formData.price})`)
        return
      }

      // Validate cost_price
      if (formData.cost_price && formData.cost_price < 0) {
        toast.error('Cost price must be positive')
        return
      }

      console.log('📤 Sending product update request:', {
        productId: params?.id,
        formData: {
          ...formData,
          // Log data types for debugging
          price: `${formData.price} (${typeof formData.price})`,
          stock_quantity: `${formData.stock_quantity} (${typeof formData.stock_quantity})`,
        }
      })

      const response = await fetch(`/api/admin/products/${params?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      console.log('📥 Product update response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Product update failed - Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        })

        let errorMessage = 'Failed to update product'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, use the text as error message
          errorMessage = errorText || errorMessage
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('✅ Product update result:', result)

      if (!result.success) {
        console.error('❌ Product update failed - Result not successful:', result)
        throw new Error(result.error || 'Failed to update product')
      }

      // PHASE 1 FIX: Force fresh database fetch after successful save
      console.log('✅ Product update successful - forcing fresh data reload')

      // Instead of updating form state with response data, force a fresh database fetch
      // This ensures we get the absolute latest data from the database
      if (params?.id) {
        await loadProduct(params.id as string, true)
      }

      console.log('🔄 Fresh product data reloaded after save')

      toast.success('Product updated successfully!')
      // Don't redirect immediately - let user see the updated values and continue editing if needed
      // router.push(`/${params.locale}/fyponly-admin/products`)
    } catch (error) {
      console.error('❌ Error updating product:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        formData: formData
      })

      const errorMessage = error instanceof Error ? error.message : 'Failed to update product'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      }

      // When bestseller is toggled OFF, clear the position
      if (field === 'is_best_seller' && value === false) {
        newData.best_seller_position = 0
      }

      // No manual trending position any more

      return newData
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Product not found</h2>
          <p className="text-gray-600 mt-2">The product you're looking for doesn't exist.</p>
          <Button asChild className="mt-4">
            <Link href={`/${params?.locale || 'en'}/fyponly-admin/products`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // --- YouTube helpers & handlers ---
  const extractYouTubeId = (input: string): string | null => {
    try {
      if (!input) return null
      const raw = String(input).trim()

      // If an iframe embed code is provided, extract its src attribute
      if (/^<iframe[\s\S]*?>/i.test(raw) || raw.toLowerCase().includes('<iframe')) {
        const match = raw.match(/src=["']([^"']+)["']/i)
        if (match && match[1]) {
          return extractYouTubeId(match[1])
        }
      }

      // Ensure we have a full URL
      const maybeUrl = raw.startsWith('//') ? `https:${raw}` : raw
      const u = new URL(maybeUrl)
      const host = u.hostname

      // youtu.be short links
      if (host.includes('youtu.be')) {
        const id = u.pathname.replace(/^\//, '').split('/')[0]
        return id || null
      }

      // youtube.com (includes m.youtube.com, www.youtube.com)
      if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
        // Standard watch URL
        if (u.pathname === '/watch') {
          return u.searchParams.get('v')
        }
        // Embedded URL
        if (u.pathname.startsWith('/embed/')) {
          const id = u.pathname.split('/')[2]
          return id || null
        }
        // Shorts URL
        if (u.pathname.startsWith('/shorts/')) {
          const id = u.pathname.split('/')[2] || u.pathname.replace('/shorts/', '')
          return (id || '').split('?')[0] || null
        }
      }

      return null
    } catch {
      return null
    }
  }

  const handleAddVideo = () => {
    const id = extractYouTubeId(videoUrl.trim())
    if (!id) {
      toast.error('Please enter a valid YouTube URL or iframe embed code')
      return
    }
    const normalized = `https://www.youtube.com/watch?v=${id}`
    const currentVideos = formData.videos || []
    if (currentVideos.includes(normalized)) {
      toast.message('This video is already added')
      return
    }
    handleInputChange('videos', [...currentVideos, normalized])
    setProduct(prev => prev ? { ...prev, videos: [...(prev.videos || []), normalized] } : prev)
    setVideoUrl('')
    toast.success('Video added')
  }

  const handleRemoveVideo = (index: number) => {
    const next = (formData.videos || []).filter((_, i) => i !== index)
    handleInputChange('videos', next)
    setProduct(prev => prev ? { ...prev, videos: (prev.videos || []).filter((_, i) => i !== index) } : prev)
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${params?.locale || 'en'}/fyponly-admin/products`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-gray-600">Update product information and settings</p>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="min-w-[120px]"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Essential product details and identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    placeholder="Enter product SKU"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    placeholder="Enter brand name"
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category_id || ''}
                  onValueChange={(v) => handleInputChange('category_id', v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={categoriesLoading ? 'Loading categories...' : 'Select category'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              <div className="space-y-2">
                <Label htmlFor="name_en">Product Name (English) *</Label>
                <Input
                  id="name_en"
                  placeholder="Enter product name in English"
                  value={formData.name_en}
                  onChange={(e) => handleInputChange('name_en', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name_ja">Product Name (Japanese)</Label>
                <Input
                  id="name_ja"
                  placeholder="Enter product name in Japanese"


                  value={formData.name_ja}
                  onChange={(e) => handleInputChange('name_ja', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Descriptions */}
          <Card>
            <CardHeader>
              <CardTitle>Descriptions</CardTitle>
              <CardDescription>
                Product descriptions for different languages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="short_description_en">Short Description (English)</Label>
                <Textarea
                  id="short_description_en"
                  placeholder="Brief product description in English"
                  className="min-h-[80px]"
                  value={formData.short_description_en}
                  onChange={(e) => handleInputChange('short_description_en', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description_en">Full Description (English)</Label>
                <Textarea
                  id="description_en"
                  placeholder="Detailed product description in English"
                  className="min-h-[120px]"
                  value={formData.description_en}
                  onChange={(e) => handleInputChange('description_en', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description_ja">Short Description (Japanese)</Label>
                <Textarea
                  id="short_description_ja"
                  placeholder="Brief product description in Japanese"
                  className="min-h-[80px]"
                  value={formData.short_description_ja}
                  onChange={(e) => handleInputChange('short_description_ja', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description_ja">Full Description (Japanese)</Label>
                <Textarea
                  id="description_ja"
                  placeholder="Detailed product description in Japanese"
                  className="min-h-[120px]"
                  value={formData.description_ja}
                  onChange={(e) => handleInputChange('description_ja', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>
                Product pricing and cost information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compare_at_price">Compare at Price</Label>
                  <Input
                    id="compare_at_price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.compare_at_price}
                    onChange={(e) => handleInputChange('compare_at_price', parseFloat(e.target.value) || 0)}
                    className={
                      formData.compare_at_price && formData.compare_at_price > 0 && formData.compare_at_price < formData.price
                        ? 'border-red-500 focus:border-red-500'
                        : ''
                    }
                  />
                  <p className="text-sm text-gray-600">Original price for sale comparison</p>
                  {formData.compare_at_price && formData.compare_at_price > 0 && formData.compare_at_price < formData.price && (
                    <p className="text-sm text-red-600">Compare at price must be greater than or equal to regular price ($${formData.price})</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.cost_price}
                    onChange={(e) => handleInputChange('cost_price', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-sm text-gray-600">Your cost for this product</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
              <CardDescription>
                Stock management and inventory settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity">Stock Quantity *</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    placeholder="0"
                    value={formData.stock_quantity}
                    onChange={(e) => handleInputChange('stock_quantity', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                  <Input
                    id="low_stock_threshold"
                    type="number"
                    placeholder="10"
                    value={formData.low_stock_threshold}
                    onChange={(e) => handleInputChange('low_stock_threshold', parseInt(e.target.value) || 10)}
                  />
                  <p className="text-sm text-gray-600">Alert when stock falls below this number</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Track Inventory</Label>
                    <p className="text-sm text-gray-600">
                      Monitor stock levels for this product
                    </p>
                  </div>
                  <Switch
                    checked={formData.track_inventory}
                    onCheckedChange={(checked) => handleInputChange('track_inventory', checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Allow Backorder</Label>
                    <p className="text-sm text-gray-600">
                      Allow orders when out of stock
                    </p>
                  </div>
                  <Switch
                    checked={formData.allow_backorder}
                    onCheckedChange={(checked) => handleInputChange('allow_backorder', checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Pre-order</Label>
                    <p className="text-sm text-gray-600">
                      This is a pre-order product
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_preorder}
                    onCheckedChange={(checked) => handleInputChange('is_preorder', checked)}
                  />
                </div>
              </div>

              {formData.is_preorder && (
                <div className="space-y-2">
                  <Label htmlFor="preorder_limit">Pre-order Limit</Label>
                  <Input
                    id="preorder_limit"
                    type="number"
                    placeholder="0"
                    value={formData.preorder_limit}
                    onChange={(e) => handleInputChange('preorder_limit', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-gray-600">Maximum number of pre-orders allowed (0 = unlimited)</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Product Settings</CardTitle>
              <CardDescription>
                Additional product configuration options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight_grams">Weight (grams)</Label>
                  <Input
                    id="weight_grams"
                    type="number"
                    placeholder="0"
                    value={formData.weight_grams}
                    onChange={(e) => handleInputChange('weight_grams', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-gray-600">Product weight for shipping calculations</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Active</Label>
                    <p className="text-sm text-gray-600">
                      Product is available for sale
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Featured</Label>
                    <p className="text-sm text-gray-600">
                      Show in featured products
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => handleInputChange('is_featured', checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Requires Shipping</Label>
                    <p className="text-sm text-gray-600">
                      Physical product needs shipping
                    </p>
                  </div>
                  <Switch
                    checked={formData.requires_shipping}
                    onCheckedChange={(checked) => handleInputChange('requires_shipping', checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Digital Product</Label>
                    <p className="text-sm text-gray-600">
                      This is a digital product
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_digital}
                    onCheckedChange={(checked) => handleInputChange('is_digital', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Categorization */}
          <Card>
            <CardHeader>
              <CardTitle>Product Categorization</CardTitle>
              <CardDescription>
                Mark products as trending or best sellers for special display
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Trending Product */}
                <div className="space-y-4">
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Trending Product</Label>
                      <p className="text-sm text-gray-600">
                        Mark this product as trending
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_trending}
                      onCheckedChange={(checked) => handleInputChange('is_trending', checked)}
                    />
                  </div>

                  {/* Trending position removed: ordering now automatic (stock-first + random within groups) */}
                </div>

                {/* Best Seller Product */}


                <div className="space-y-4">
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Best Seller</Label>
                      <p className="text-sm text-gray-600">
                        Mark this product as a best seller
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_best_seller}
                      onCheckedChange={(checked) => handleInputChange('is_best_seller', checked)}
                    />
                  </div>

                  {formData.is_best_seller && (
                    <div className="space-y-2">
                      <Label htmlFor="best_seller_position">Best Seller Position</Label>
                      <Input
                        id="best_seller_position"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formData.best_seller_position}
                        onChange={(e) => handleInputChange('best_seller_position', parseInt(e.target.value) || 0)}
                      />
                      <p className="text-sm text-gray-600">Lower numbers appear first (1 = top position)</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Images */}
          {product && (
            <ProductImagesDisplay
              images={product.images || []}
              productSku={product.sku}
              isEditable={true}
              onImagesChange={(newImages) => {
                // Update the form state with new images
                handleInputChange('images', newImages)
                // Update the local product state
                setProduct(prev => prev ? { ...prev, images: newImages } : null)
              }}
            />
          )}


          {/* Product Videos (YouTube) */}
          <Card>
            <CardHeader>
              <CardTitle>Product Videos (YouTube)</CardTitle>
              <CardDescription>
                Paste a YouTube URL and click Add. Videos appear alongside images on the product page. BoxHero sync will not touch videos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="YouTube URL (watch/shorts/youtu.be) or paste <iframe ...> embed code"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <Button type="button" onClick={handleAddVideo} className="sm:w-40">Add Video</Button>
              </div>

              {(formData.videos && formData.videos.length > 0) ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {formData.videos.map((url, idx) => {
                    const id = extractYouTubeId(url)
                    const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''
                    return (
                      <div key={`${url}-${idx}`} className="relative rounded-lg border overflow-hidden bg-muted">
                        {thumb ? (
                          <div className="aspect-video w-full overflow-hidden">
                            <img src={thumb} alt={`YouTube video ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-black/60 rounded-full p-2">
                                <Play className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video w-full flex items-center justify-center text-xs text-gray-500">Invalid URL</div>
                        )}
                        <div className="p-2 text-xs truncate text-gray-700 bg-white/80">{url}</div>
                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(idx)}
                          className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1 shadow"
                          aria-label="Remove video"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (


                <p className="text-sm text-muted-foreground">No videos added yet.</p>
              )}
            </CardContent>
          </Card>


          {/* Media Order (Images & Videos) */}
          {product && (
            <ProductMediaOrder
              images={formData.images || []}
              videos={formData.videos || []}
              order={(product as any).media_order || formData.media_order || []}
              onChange={(order) => {
                handleInputChange('media_order', order)
                setProduct(prev => prev ? { ...(prev as any), media_order: order } : prev)
              }}
            />
          )}

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>
                Search engine optimization settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seo_title">SEO Title</Label>


                <Input
                  id="seo_title"
                  placeholder="SEO optimized title"
                  value={formData.seo_title}
                  onChange={(e) => handleInputChange('seo_title', e.target.value)}
                />
                <p className="text-sm text-gray-600">Title tag for search engines</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo_description">SEO Description</Label>
                <Textarea
                  id="seo_description"
                  placeholder="SEO optimized description"
                  className="min-h-[80px]"
                  value={formData.seo_description}
                  onChange={(e) => handleInputChange('seo_description', e.target.value)}
                />
                <p className="text-sm text-gray-600">Meta description for search engines</p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" asChild>
              <Link href={`/${params?.locale || 'en'}/fyponly-admin/products`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[120px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
    </div>
  )
}
