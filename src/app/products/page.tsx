import type { Metadata } from "next";
import { Filters } from "@/components/product/Filters";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getCategories, getProducts, type SortKey } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop all products — Maximize",
};

type SearchParams = {
  category?: string;
  search?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const [products, cats] = await Promise.all([
    getProducts({
      category: sp.category,
      search: sp.search,
      sort: sp.sort as SortKey | undefined,
      minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
      maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    }),
    getCategories(),
  ]);

  const navCategories = cats.map((c) => ({
    name: c.name,
    slug: c.slug,
    count: c._count.products,
  }));

  const activeCat = navCategories.find((c) => c.slug === sp.category);
  const heading = sp.search
    ? `Results for “${sp.search}”`
    : activeCat
      ? activeCat.name
      : "All products";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <nav className="text-sm text-muted">
          <span>Home</span> <span className="mx-1">/</span> <span>Shop</span>
          {activeCat && (
            <>
              <span className="mx-1">/</span>
              <span className="text-foreground">{activeCat.name}</span>
            </>
          )}
        </nav>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-1 text-muted">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <Filters
            categories={navCategories}
            activeCategory={sp.category}
            activeSort={sp.sort}
            minPrice={sp.minPrice}
            maxPrice={sp.maxPrice}
          />
        </aside>

        <div>
          {products.length === 0 ? (
            <div className="rounded-xl border border-dashed py-20 text-center">
              <p className="text-muted">No products match your filters.</p>
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>
    </div>
  );
}
