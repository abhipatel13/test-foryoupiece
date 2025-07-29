'use client'

import { Header } from './header'
import { Footer } from './footer'
import { Toaster } from '@/components/ui/sonner'
import { KeyboardShortcuts } from '@/components/accessibility/keyboard-shortcuts'

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
