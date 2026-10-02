"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { StarRating } from "@/components/ui/StarRating";
import { formatPrice } from "@/lib/format";

export interface CardProduct {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  compareAtCents?: number | null;
  currency: string;
  image: string;
  rating: number;
  reviews: number;
  badge?: string | null;
  categoryName?: string;
}

const badgeStyles: Record<string, string> = {
  Sale: "bg-danger text-white",
  New: "bg-accent text-accent-foreground",
  "Best Seller": "bg-foreground text-background",
  "Great Deal": "bg-foreground text-background",
  "Big Sale": "bg-foreground text-background",
  "Lightning Deal": "bg-amber-500 text-white",
};

export function ProductCard({ product }: { product: CardProduct }) {
  const { add } = useCart();

  const onSale =
    product.compareAtCents != null && product.compareAtCents > product.priceCents;
  const discount = onSale
    ? Math.round((1 - product.priceCents / product.compareAtCents!) * 100)
    : 0;

  return (
    <div className="group relative flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-surface"
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {onSale && (
            <span className="rounded-full bg-danger px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              -{discount}%
            </span>
          )}
          {product.badge && (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                badgeStyles[product.badge] ?? "bg-foreground text-background"
              }`}
            >
              {product.badge}
            </span>
          )}
        </div>
      </Link>

      {/* Quick-add — appears on hover (and always visible on touch) */}
      <button
        type="button"
        onClick={() =>
          add({
            id: product.id,
            slug: product.slug,
            name: product.name,
            priceCents: product.priceCents,
            currency: product.currency,
            image: product.image,
          })
        }
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:bg-accent hover:text-accent-foreground md:opacity-0 md:group-hover:opacity-100"
        aria-label={`Add ${product.name} to cart`}
      >
        <Plus size={18} />
      </button>

      <div className="mt-3 flex flex-col gap-1">
        {product.categoryName && (
          <span className="text-xs uppercase tracking-wide text-muted">
            {product.categoryName}
          </span>
        )}
        <Link href={`/products/${product.slug}`} className="font-medium leading-snug hover:underline">
          {product.name}
        </Link>
        <StarRating rating={product.rating} reviews={product.reviews} />
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`font-semibold ${onSale ? "text-danger" : ""}`}>
            {formatPrice(product.priceCents, product.currency)}
          </span>
          {onSale && (
            <span className="text-sm text-muted line-through">
              {formatPrice(product.compareAtCents!, product.currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
