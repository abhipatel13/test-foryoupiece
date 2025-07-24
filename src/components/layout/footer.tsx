import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { FooterCategories } from './footer-categories'

export function Footer() {
  const t = useTranslations('navigation')

  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-16 max-w-screen-2xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Company Info - Modern */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Image
                src="/favicon.jpg"
                alt="ForYouPiece"
                width={32}
                height={32}
                className="rounded-lg shadow-sm object-contain flex-shrink-0"
              />
              <Image
                src="/logo.jpg"
                alt="ForYouPiece"
                width={80}
                height={24}
                className="object-contain flex-shrink-0"
              />
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              Premium quality products delivered worldwide. Experience the best of craftsmanship and innovation with our curated selection.
            </p>
            <div className="flex space-x-2">
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary">
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary">
                <span className="sr-only">Instagram</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Shop - Dynamic BoxHero Categories */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Shop
            </h3>
            <FooterCategories />
          </div>

          {/* Support */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Support
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/help" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Company
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 ForYouPiece. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-sm text-muted-foreground">Powered by</span>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-foreground">Next.js</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm font-medium text-foreground">Supabase</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm font-medium text-foreground">Vercel</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
