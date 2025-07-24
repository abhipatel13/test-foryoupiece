import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
