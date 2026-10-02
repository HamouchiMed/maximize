"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { StarRating } from "@/components/ui/StarRating";
import { formatPrice } from "@/lib/format";

export interface DetailProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  compareAtCents?: number | null;
  currency: string;
  image: string;
  images: string[];
  rating: number;
  reviews: number;
  stock: number;
  badge?: string | null;
  categoryName?: string;
}

export function ProductDetail({
  product,
  savedInWishlist = false,
}: {
  product: DetailProduct;
  savedInWishlist?: boolean;
}) {
  const { add } = useCart();
  const router = useRouter();
  const gallery = [product.image, ...product.images];
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);

  const inStock = product.stock > 0;
  const onSale =
    product.compareAtCents != null && product.compareAtCents > product.priceCents;
  const discount = onSale
    ? Math.round((1 - product.priceCents / product.compareAtCents!) * 100)
    : 0;

  function addToCart() {
    add(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        currency: product.currency,
        image: product.image,
      },
      qty
    );
  }

  function buyNow() {
    // Add to cart, then go to the delivery-address step where the order is
    // created after the customer confirms where to ship.
    setBuying(true);
    addToCart();
    router.push("/checkout");
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        <div className="flex gap-3 sm:flex-col">
          {gallery.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-20 ${
                i === active ? "border-accent" : "border-transparent"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
        <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-2xl bg-surface">
          <Image
            src={gallery[active]}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col">
        {product.categoryName && (
          <span className="text-sm uppercase tracking-wide text-muted">
            {product.categoryName}
          </span>
        )}
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>
        <div className="mt-3">
          <StarRating rating={product.rating} reviews={product.reviews} size={16} />
        </div>
        <div className="mt-5 flex flex-wrap items-baseline gap-3">
          <p className={`text-3xl font-semibold ${onSale ? "text-danger" : ""}`}>
            {formatPrice(product.priceCents, product.currency)}
          </p>
          {onSale && (
            <>
              <p className="text-xl text-muted line-through">
                {formatPrice(product.compareAtCents!, product.currency)}
              </p>
              <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-white">
                Save {discount}%
              </span>
            </>
          )}
        </div>

        <p className="mt-5 leading-relaxed text-muted">{product.description}</p>

        <div className="mt-6 flex items-center gap-2 text-sm">
          {inStock ? (
            <>
              <Check size={16} className="text-success" />
              <span className="text-success">In stock</span>
              <span className="text-muted">· ships in 1–2 business days</span>
            </>
          ) : (
            <span className="text-danger">Out of stock</span>
          )}
        </div>

        {/* Quantity + actions */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center rounded-full border">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="p-3 hover:text-accent"
              aria-label="Decrease quantity"
            >
              <Minus size={16} />
            </button>
            <span className="w-10 text-center font-medium">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="p-3 hover:text-accent"
              aria-label="Increase quantity"
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            onClick={addToCart}
            disabled={!inStock}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            <ShoppingBag size={18} /> Add to cart
          </button>

          <WishlistButton productId={product.id} initialSaved={savedInWishlist} />
        </div>

        <button
          onClick={buyNow}
          disabled={!inStock || buying}
          className="mt-3 w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {buying ? "Redirecting…" : "Buy it now"}
        </button>

        <div className="mt-6 flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
          <Truck size={18} className="mt-0.5 text-accent" />
          <div>
            <p className="font-medium">Free shipping over 300 DH</p>
            <p className="text-muted">30-day returns · 2-year warranty on devices</p>
          </div>
        </div>
      </div>
    </div>
  );
}
