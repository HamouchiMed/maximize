"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import type { NavCategory } from "@/components/layout/Header";

/**
 * Horizontal category strip shown under the main header (AliExpress/Temu style).
 * Browsable by everyone — scrolls sideways on small screens.
 */
export function CategoryBar({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeCategory = params.get("category");
  const activeSort = params.get("sort");
  const onProducts = pathname === "/products";

  // Only show the category strip on the home page.
  if (pathname !== "/") return null;

  // Highlight helper for the current selection.
  const linkClass = (active: boolean) =>
    `whitespace-nowrap text-sm transition-colors hover:text-accent ${
      active ? "font-semibold text-accent" : "text-foreground/80"
    }`;

  return (
    <div className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* All categories */}
        <Link
          href="/products"
          className={`flex flex-shrink-0 items-center gap-2 rounded-full bg-surface px-4 py-1.5 text-sm font-medium transition-colors hover:text-accent ${
            onProducts && !activeCategory && !activeSort ? "text-accent" : ""
          }`}
        >
          <Menu size={16} /> All Categories
        </Link>

        {/* Quick promos */}
        <Link
          href="/products?sort=price-asc"
          className={`whitespace-nowrap text-sm font-semibold transition-colors hover:opacity-80 ${
            activeSort === "price-asc" ? "text-accent" : "text-danger"
          }`}
        >
          Deals
        </Link>
        <Link href="/products?sort=newest" className={linkClass(activeSort === "newest")}>
          New
        </Link>
        <Link href="/products?sort=rating" className={linkClass(activeSort === "rating")}>
          Best Sellers
        </Link>

        {/* One link per category */}
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className={linkClass(activeCategory === c.slug)}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
