import { ProductCard, type CardProduct } from "@/components/product/ProductCard";
import type { ProductWithCategory } from "@/lib/products";

export function toCardProduct(p: ProductWithCategory): CardProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    currency: p.currency,
    image: p.image,
    rating: p.rating,
    reviews: p.reviews,
    badge: p.badge,
    categoryName: p.category?.name,
  };
}

export function ProductGrid({ products }: { products: ProductWithCategory[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={toCardProduct(p)} />
      ))}
    </div>
  );
}
