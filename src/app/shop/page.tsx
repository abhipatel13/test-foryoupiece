'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ShopRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the correct products page
    router.replace('/en/products')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Redirecting...</h1>
        <p className="text-gray-600">Taking you to our product catalog</p>
      </div>
    </div>
  )
}
