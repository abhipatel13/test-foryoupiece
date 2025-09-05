import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VercelAnalytics } from "@/components/analytics/VercelAnalytics";


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
      { url: '/favicon.ico?v=3', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon.jpg?v=3', sizes: '32x32', type: 'image/jpeg' },
    ],
    shortcut: ['/favicon.ico?v=3', '/favicon.jpg?v=3'],
    apple: [
      { url: '/favicon.jpg?v=3', sizes: '180x180', type: 'image/jpeg' },
    ],
  },
  manifest: '/site.webmanifest?v=3',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { headers } from 'next/headers'

// Root layout for direct root access
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') || undefined

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          id="chunk-error-handler"
          strategy="beforeInteractive"
          nonce={nonce}
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
        <Script
          id="marketing-consent-auto"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Always grant marketing consent (Cambodia policy)
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('fyp_consent_marketing', 'true');
                }
                // Set cookie for server-side CAPI (read by API routes)
                (function(){
                  var isHttps = (typeof location !== 'undefined' && location.protocol === 'https:');
                  var attrs = ['Path=/', 'SameSite=Lax', 'Max-Age=31536000']; // 1 year
                  if (isHttps) attrs.push('Secure');
                  document.cookie = 'fyp_consent_marketing=true; ' + attrs.join('; ');
                })();
              } catch (_e) {}
            `,
          }}
        />
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var DEBUG = ${JSON.stringify(process.env.NEXT_PUBLIC_DEBUG_ANALYTICS === 'true')};
                  var PIXEL_ID = ${JSON.stringify(process.env.NEXT_PUBLIC_META_PIXEL_ID || '')};
                  if (!PIXEL_ID) { if (DEBUG) console.warn('Meta Pixel: NEXT_PUBLIC_META_PIXEL_ID not set; skipping'); return; }

                  function hasMarketingConsent() {
                    try {
                      var key = 'fyp_consent_marketing';
                      var fromLS = null;
                      try { fromLS = (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : null; } catch(_) {}
                      var fromCookie = (typeof document !== 'undefined' && document.cookie && document.cookie.indexOf('fyp_consent_marketing=true') !== -1) ? 'true' : null;
                      return (fromLS === 'true') || (fromCookie === 'true');
                    } catch (e) { return false; }
                  }

                  if (!hasMarketingConsent()) { if (DEBUG) console.log('Meta Pixel: consent not granted; not loading'); return; }

                  !function(f,b,e,v,n,t,s){
                    if(f.fbq) return; n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments) };
                    if(!f._fbq) f._fbq=n; n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[];
                    t=b.createElement(e); t.async=!0; t.src=v; s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s);
                  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

                  fbq('init', PIXEL_ID);
                  var PV_ID = 'pv_' + Date.now() + '_' + Math.floor(Math.random()*1e6);
                  fbq('track', 'PageView', {}, { eventID: PV_ID });
                  try {
                    fetch('/api/analytics/pageview', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: PV_ID, sourceUrl: (typeof location !== 'undefined' ? location.href : undefined), consent: true })
                    }).catch(function(){});
                  } catch(_e) {}
                  if (DEBUG) console.log('Meta Pixel initialized', { PIXEL_ID, PV_ID });
                } catch (err) {
                  try { console.error('Meta Pixel init error', err); } catch (_e) {}
                }
              })();
            `,
          }}
        />
        {children}
        <VercelAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
