'use client'

import { Header } from './header'
import { Footer } from './footer'
import { Toaster } from '@/components/ui/sonner'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}
