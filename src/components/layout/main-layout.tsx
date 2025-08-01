'use client'

import { Header } from './header'
import { Footer } from './footer'
import { KeyboardShortcuts } from '@/components/accessibility/keyboard-shortcuts'
import dynamic from 'next/dynamic'

// Dynamically import Toaster to avoid SSR issues with sonner
const Toaster = dynamic(
  () => import('@/components/ui/sonner').then((mod) => ({ default: mod.Toaster })),
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
    <div className="min-h-screen flex flex-col">
      <KeyboardShortcuts />
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}
