import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { FooterCategories } from './footer-categories'
import { Video, Instagram, Facebook, Send } from 'lucide-react'

export function Footer() {
  const t = useTranslations('navigation')

  return (
    <footer className="bg-background border-t border-border overflow-x-hidden">
      <div className="desktop-container py-8 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
          {/* Company Info - Modern */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Image
                src="/favicon.jpg"
                alt="Foryoupiece"
                width={32}
                height={32}
                className="rounded-lg shadow-sm object-contain flex-shrink-0"
                priority
              />
              <div className="relative" style={{ width: 80, height: 24 }}>
                <Image
                  src="/logo.jpg"
                  alt="Foryoupiece"
                  fill
                  sizes="80px"
                  className="object-contain flex-shrink-0"
                  priority
                />
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              Premium Japanese products delivered directly from Japan to Cambodia. Experience the highest quality and most comprehensive selection of authentic, curated products from Japan and worldwide.
            </p>
            <div className="flex space-x-2">
              <Link
                href="https://www.tiktok.com/@foryoupiece.select"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary"
              >
                <span className="sr-only">TikTok</span>
                <Video className="h-5 w-5" />
              </Link>
              <Link
                href="https://www.instagram.com/foryoupiece.select/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary"
              >
                <span className="sr-only">Instagram</span>
                <Instagram className="h-5 w-5" />
              </Link>
              <Link
                href="https://www.facebook.com/foryoupiece.select"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary"
              >
                <span className="sr-only">Facebook</span>
                <Facebook className="h-5 w-5" />
              </Link>
              <Link
                href="https://t.me/foryoupiece_support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-secondary"
              >
                <span className="sr-only">Telegram</span>
                <Send className="h-5 w-5" />
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
                <Link href="/en/help" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/en/shipping" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/en/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/en/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">
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
                <Link href="/en/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/en/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/en/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 Foryoupiece. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-sm text-muted-foreground">Powered by</span>
              <span className="text-sm font-medium text-foreground">Foryoupiece technology</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
