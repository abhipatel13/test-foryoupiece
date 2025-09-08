import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { MainLayout } from '@/components/layout/main-layout'
import { QueryProvider } from '@/lib/providers/query-provider'
import { AuthProvider } from '@/lib/providers/auth-provider'
import BrandsPage from '../[locale]/brands/page'

export default async function RootBrandsPage() {
  const messages = await getMessages({ locale: 'en' })
  return (
    <QueryProvider>
      <AuthProvider>
        <NextIntlClientProvider messages={messages} locale="en">
          <MainLayout>
            <BrandsPage />
          </MainLayout>
        </NextIntlClientProvider>
      </AuthProvider>
    </QueryProvider>
  )
}

