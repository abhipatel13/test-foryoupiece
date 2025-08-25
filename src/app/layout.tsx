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
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon.jpg?v=2', sizes: '32x32', type: 'image/jpeg' },
    ],
    shortcut: ['/favicon.ico?v=2', '/favicon.jpg?v=2'],
    apple: [
      { url: '/favicon.jpg?v=2', sizes: '180x180', type: 'image/jpeg' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
