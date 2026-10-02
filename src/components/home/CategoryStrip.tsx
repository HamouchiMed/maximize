import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { ProductWithCategory } from "@/lib/products";

// Curated categories shown on the home page, each with a representative photo.
const FEATURED_CATEGORIES = [
  { name: "Apparel", slug: "apparel", img: "/products/38-1.avif" },
  { name: "Footwear", slug: "footwear", img: "/products/10-1.avif" },
  { name: "Bags", slug: "bags", img: "/products/34-1.avif" },
  { name: "Toys & Games", slug: "toys", img: "/products/5-1.avif" },
  { name: "Beauty & Health", slug: "beauty", img: "/products/37-1.avif" },
  { name: "Home & Kitchen", slug: "home", img: "/products/3-1.avif" },
];

function soldLabel(reviews: number) {
  return reviews > 1000 ? "1,000+ sold" : `${reviews.toLocaleString("en-US")} sold`;
}

function PromoCard({ p }: { p: ProductWithCategory }) {
  const onSale = p.compareAtCents != null && p.compareAtCents > p.priceCents;
  return (
    <Link
      href={`/products/${p.slug}`}
      className="group block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5"
    >
      <div className="relative aspect-square">
        <Image
          src={p.image}
          alt={p.name}
          fill
          sizes="(max-width: 1024px) 30vw, 130px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-2.5">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-sm font-bold text-neutral-900">
            {formatPrice(p.priceCents, p.currency)}
          </span>
          {onSale && (
            <span className="text-[11px] text-neutral-400 line-through">
              {formatPrice(p.compareAtCents!, p.currency)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
          <Star size={11} className="fill-amber-400 text-amber-400" />
          <span className="font-medium text-neutral-700">{p.rating.toFixed(1)}</span>
          <span aria-hidden>·</span>
          <span>{soldLabel(p.reviews)}</span>
        </div>
      </div>
    </Link>
  );
}

export function CategoryStrip({ promoProducts }: { promoProducts: ProductWithCategory[] }) {
  const cards = promoProducts.slice(0, 3);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <h2 className="mb-8 text-center text-3xl font-bold tracking-tight sm:text-4xl">
        Shop by category
      </h2>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {/* Left promo panel */}
        <div className="relative flex min-h-[460px] flex-col overflow-hidden rounded-2xl bg-sky-100 p-6 sm:p-8 lg:min-h-full">
          {/* Fashion hero image on the right half */}
          <Image
            src="/products/38-1.avif"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 640px"
            className="pointer-events-none absolute inset-y-0 right-0 left-auto hidden w-1/2 object-cover object-top sm:block"
          />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-sky-100 via-sky-100/70 to-transparent sm:block" />

          {/* Brand copy */}
          <div className="relative z-10">
            <p className="font-serif text-5xl italic leading-none text-neutral-900">Viva</p>
            <p className="mt-3 text-sm font-medium text-neutral-700">Your fashion choice</p>
            <Link
              href="/products"
              className="mt-5 inline-block rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              Shop now
            </Link>
          </div>

          {/* Featured product cards */}
          <div className="relative z-10 mt-auto grid grid-cols-3 gap-3 pt-8">
            {cards.map((p) => (
              <PromoCard key={p.id} p={p} />
            ))}
          </div>
        </div>

        {/* Right category grid (2 x 3) */}
        <div className="grid h-full grid-cols-2 grid-rows-3 gap-4">
          {FEATURED_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/products?category=${c.slug}`}
              className="group relative flex min-h-[140px] items-stretch overflow-hidden rounded-2xl bg-surface"
            >
              <div className="flex flex-1 items-start p-5">
                <span className="text-lg font-bold leading-tight text-foreground">
                  {c.name}
                </span>
              </div>
              <div className="relative w-2/5 flex-shrink-0">
                <Image
                  src={c.img}
                  alt={c.name}
                  fill
                  sizes="180px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
