import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Foryoupiece - Premium E-commerce",
  description: "Discover premium Japanese products delivered directly from Japan to Cambodia. Experience authentic quality with our modern e-commerce platform featuring loyalty points and seamless shopping experience.",
  keywords: "premium Japanese products, Japan to Cambodia shipping, authentic Japanese goods, e-commerce, online shopping, quality products",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  icons: {
    icon: '/favicon.jpg',
    shortcut: '/favicon.jpg',
    apple: '/favicon.jpg',
  },
};

// Root layout for direct root access
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          id="chunk-error-handler"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Handle chunk loading errors
              window.addEventListener('error', function(e) {
                if (e.error && e.error.name === 'ChunkLoadError') {
                  console.warn('ChunkLoadError detected, reloading page...');
                  if (window.location.pathname !== '/') {
                    // Store current path and reload
                    sessionStorage.setItem('chunk-error-redirect', window.location.pathname);
                    window.location.reload();
                  }
                }
              }, true);
              
              // Check for redirect after reload
              if (sessionStorage.getItem('chunk-error-redirect')) {
                const redirect = sessionStorage.getItem('chunk-error-redirect');
                sessionStorage.removeItem('chunk-error-redirect');
                if (window.location.pathname === '/' && redirect !== '/') {
                  window.location.href = redirect;
                }
              }
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
