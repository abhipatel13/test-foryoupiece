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
  title: "ForYouPiece - Premium E-commerce",
  description: "Discover premium quality products with our modern e-commerce platform featuring Telegram login, loyalty points, and seamless shopping experience.",
  keywords: "premium products, e-commerce, online shopping, quality goods, Telegram login",
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
