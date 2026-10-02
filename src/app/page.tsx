import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero, type HeroProduct } from "@/components/home/Hero";
import { FeatureBar } from "@/components/home/FeatureBar";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { PromoTiles } from "@/components/home/PromoTiles";
import { Newsletter } from "@/components/home/Newsletter";
import { CategoryBar } from "@/components/layout/CategoryBar";
import { ProductGrid } from "@/components/product/ProductGrid";
import {
  getCategories,
  getFeaturedProducts,
  getNewestProducts,
  getProducts,
  type ProductWithCategory,
} from "@/lib/products";

const toHero = (p: ProductWithCategory): HeroProduct => ({
  slug: p.slug,
  name: p.name,
  image: p.image,
  priceCents: p.priceCents,
  compareAtCents: p.compareAtCents,
  currency: p.currency,
});

export default async function HomePage() {
  const [categories, featured, newest, homeProducts] = await Promise.all([
    getCategories(),
    getFeaturedProducts(8),
    getNewestProducts(4),
    getProducts({ category: "home" }),
  ]);
  const navCategories = categories.map((c) => ({
    name: c.name,
    slug: c.slug,
    count: c._count.products,
  }));

  // Biggest discounts first, for the clearance slide's "top deal".
  const bestDeals = [...featured].sort((a, b) => {
    const da = a.compareAtCents ? 1 - a.priceCents / a.compareAtCents : 0;
    const db = b.compareAtCents ? 1 - b.priceCents / b.compareAtCents : 0;
    return db - da;
  });

  const heroCards: Record<string, HeroProduct[]> = {
    sale: featured.slice(0, 3).map(toHero),
    home: homeProducts.slice(0, 3).map(toHero),
    clearance: bestDeals.slice(0, 1).map(toHero),
  };

  return (
    <>
      <Suspense fallback={<div className="h-11 border-b" />}>
        <CategoryBar categories={navCategories} />
      </Suspense>
      <Hero cardsById={heroCards} />
      <FeatureBar />
      <CategoryStrip promoProducts={featured} />

      {/* Featured / best sellers */}
      <section className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Best sellers</h2>
            <p className="mt-1 text-muted">The gear everyone&apos;s talking about.</p>
          </div>
          <Link
            href="/products?sort=rating"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            View all <ArrowRight size={15} />
          </Link>
        </div>
        <ProductGrid products={featured} />
      </section>

      <PromoTiles />

      {/* New arrivals */}
      <section className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">New arrivals</h2>
            <p className="mt-1 text-muted">Fresh drops, just in.</p>
          </div>
          <Link
            href="/products?sort=newest"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            View all <ArrowRight size={15} />
          </Link>
        </div>
        <ProductGrid products={newest} />
      </section>

      <Newsletter />
    </>
  );
}
