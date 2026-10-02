import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getProductBySlug, getProducts } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found — Maximize" };
  return {
    title: `${product.name} — Maximize`,
    description: product.description,
  };
}

function parseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Is this product already in the current user's wishlist?
  const user = await getCurrentUser();
  const savedInWishlist = user
    ? (await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId: user.id, productId: product.id } },
      })) != null
    : false;

  // Related: same category, excluding this product.
  const related = (
    await getProducts({ category: product.category.slug })
  )
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-8 text-sm text-muted">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1">/</span>
        <Link href="/products" className="hover:text-foreground">Shop</Link>
        <span className="mx-1">/</span>
        <Link
          href={`/products?category=${product.category.slug}`}
          className="hover:text-foreground"
        >
          {product.category.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <ProductDetail
        product={{
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          compareAtCents: product.compareAtCents,
          currency: product.currency,
          image: product.image,
          images: parseImages(product.images),
          rating: product.rating,
          reviews: product.reviews,
          stock: product.stock,
          badge: product.badge,
          categoryName: product.category.name,
        }}
        savedInWishlist={savedInWishlist}
      />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
