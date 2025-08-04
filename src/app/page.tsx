import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { MainLayout } from '@/components/layout/main-layout';
import { QueryProvider } from "@/lib/providers/query-provider";
import HomePage from './[locale]/page';

export default async function RootPage() {
  // Serve the default locale (en) content directly at root
  const messages = await getMessages({ locale: 'en' });

  return (
    <QueryProvider>
      <NextIntlClientProvider messages={messages} locale="en">
        <MainLayout>
          <HomePage />
        </MainLayout>
      </NextIntlClientProvider>
    </QueryProvider>
  );
}
