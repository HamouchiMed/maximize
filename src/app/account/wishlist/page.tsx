import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

export const metadata = { title: "Wish list — Maximize" };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account/wishlist");

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Wish list</h1>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <Heart size={48} className="text-border" />
          <p className="mt-4 text-muted">Your wish list is empty.</p>
          <Link
            href="/products"
            className="mt-6 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background hover:opacity-90"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ product: p }) => (
            <li key={p.id} className="flex flex-col">
              <Link
                href={`/products/${p.slug}`}
                className="relative aspect-square overflow-hidden rounded-xl bg-surface"
              >
                <Image src={p.image} alt={p.name} fill sizes="200px" className="object-cover" />
              </Link>
              <Link
                href={`/products/${p.slug}`}
                className="mt-2 line-clamp-2 text-sm font-medium hover:underline"
              >
                {p.name}
              </Link>
              <span className="mt-1 font-semibold">
                {formatPrice(p.priceCents, p.currency)}
              </span>
              <div className="mt-2">
                <WishlistButton productId={p.id} initialSaved variant="remove" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
