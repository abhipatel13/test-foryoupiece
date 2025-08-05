import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/config';
import { QueryProvider } from "@/lib/providers/query-provider";
import { AuthProvider } from '@/lib/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { SessionMonitor } from '@/components/session-monitor';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate that the incoming `locale` parameter is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <NextIntlClientProvider messages={messages}>
            {/* <SessionMonitor /> */}
            <MainLayout>
              {children}
            </MainLayout>
          </NextIntlClientProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
