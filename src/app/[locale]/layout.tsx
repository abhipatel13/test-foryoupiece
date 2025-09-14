import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/config';
import { QueryProvider } from "@/lib/providers/query-provider";
import { AuthProvider } from '@/lib/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { SessionMonitor } from '@/components/session-monitor';
import { MetaPageviewTracker } from '@/components/analytics/meta-pageview-tracker';
import { BannedUserModal } from '@/components/security/banned-user-modal';

export const dynamicParams = true

export function generateStaticParams() {
  // Return an empty list to disable static pre-generation during dev and avoid RSC param await errors
  // We still support all locales at runtime via dynamicParams
  if (process.env.NODE_ENV !== 'production') return []
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
            <SessionMonitor
              checkInterval={10 * 60 * 1000} // Check every 10 minutes for better performance
              enabled={true}
              maxRetries={2} // Reduced retries to prevent cascading failures
            />
            <MainLayout>
              <MetaPageviewTracker />
              {children}
              <BannedUserModal />
            </MainLayout>
          </NextIntlClientProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
