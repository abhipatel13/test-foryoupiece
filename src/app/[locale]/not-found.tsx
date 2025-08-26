import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Home as HomeIcon, ShoppingBag } from 'lucide-react'

export default function NotFound() {
  // English-only site; default to English paths
  const locale = 'en'
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full text-center">
        <div className="mb-6">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-700">
            404
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3">Page not found</h1>
        <p className="text-gray-600 mb-8">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={`/${locale}`}>
            <Button className="min-h-[44px]" aria-label="Back to home">
              <HomeIcon className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <Link href={`/${locale}/products`}>
            <Button variant="outline" className="min-h-[44px]" aria-label="Browse products">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Browse Products
            </Button>
          </Link>
          <Link href="#" aria-label="Go back">
            <span className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mt-2 sm:mt-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </span>
          </Link>
        </div>
      </div>
    </main>
  )
}

