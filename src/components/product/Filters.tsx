"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { NavCategory } from "@/components/layout/Header";

const sortOptions: { value: string; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top rated" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

export function Filters({
  categories,
  activeCategory,
  activeSort,
  minPrice,
  maxPrice,
}: {
  categories: NavCategory[];
  activeCategory?: string;
  activeSort?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [min, setMin] = useState(minPrice ?? "");
  const [max, setMax] = useState(maxPrice ?? "");

  function updateParam(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const categoryLink = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("category", slug);
    else params.delete("category");
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Category</h3>
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href={categoryLink(null)}
              className={`block rounded-lg px-3 py-1.5 text-sm ${
                !activeCategory ? "bg-accent-soft font-medium text-accent" : "hover:bg-surface"
              }`}
            >
              All products
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={categoryLink(c.slug)}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                  activeCategory === c.slug
                    ? "bg-accent-soft font-medium text-accent"
                    : "hover:bg-surface"
                }`}
              >
                {c.name}
                <span className="text-xs text-muted">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Sort */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Sort by</h3>
        <select
          value={activeSort ?? "featured"}
          onChange={(e) => updateParam({ sort: e.target.value })}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Price (DH)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Min"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min={0}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Max"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => updateParam({ minPrice: min || null, maxPrice: max || null })}
          className="mt-3 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
