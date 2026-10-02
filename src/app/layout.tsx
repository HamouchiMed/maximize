import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-context";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getCategories } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maximize — Fashion, Home & Everyday Deals",
  description:
    "A clean, fast online store for eyewear, footwear, bags, apparel, jewelry, beauty, home and more — at last-day prices.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cats, currentUser] = await Promise.all([getCategories(), getCurrentUser()]);
  const navCategories = cats.map((c) => ({
    name: c.name,
    slug: c.slug,
    count: c._count.products,
  }));

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider initialUser={currentUser}>
          <CartProvider>
            <Header categories={navCategories} />
            <CartDrawer />
            <main className="flex-1">{children}</main>
            <Footer categories={navCategories} />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
