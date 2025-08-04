'use client'

import { Header } from './header'
import { Footer } from './footer'
import { SSRErrorBoundary } from '@/components/error-boundary/ssr-error-boundary'
import dynamic from 'next/dynamic'

// Dynamically import Toaster to avoid SSR issues with sonner
const Toaster = dynamic(
  () => import('@/components/ui/sonner').then((mod) => ({ default: mod.Toaster })),
  {
    ssr: false,
    loading: () => null
  }
)

// Dynamically import KeyboardShortcuts with SSR safety
const KeyboardShortcuts = dynamic(
  () => import('@/components/accessibility/keyboard-shortcuts').then((mod) => ({ default: mod.KeyboardShortcuts })),
  {
    ssr: false,
    loading: () => null
  }
)

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SSRErrorBoundary>
      <div className="min-h-screen flex flex-col">
        {/* <KeyboardShortcuts /> */}
        <Header />
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <Toaster />
      </div>
    </SSRErrorBoundary>
  )
}
