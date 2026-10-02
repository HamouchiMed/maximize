import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Category-matched photos from Unsplash (free for commercial use, no attribution
// required). Swap these for your own product/lifestyle photos when you have them.
const tiles = [
  {
    title: "The desk upgrade",
    subtitle: "Laptop stands, webcams & more",
    href: "/products?category=electronics",
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
    span: "lg:col-span-2",
  },
  {
    title: "See in style",
    subtitle: "Trendy glasses & sunglasses",
    href: "/products?category=eyewear",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80",
    span: "",
  },
  {
    title: "Little luxuries",
    subtitle: "Jewelry & accessories",
    href: "/products?category=jewelry",
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=800&q=80",
    span: "",
  },
  {
    title: "Home & kitchen refresh",
    subtitle: "Cups, mirrors & cozy finds",
    href: "/products?category=home",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    span: "lg:col-span-2",
  },
];

export function PromoTiles() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className={`group relative flex aspect-[16/10] items-end overflow-hidden rounded-2xl bg-surface ${t.span}`}
          >
            <Image
              src={t.image}
              alt={t.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="relative p-6 text-white">
              <p className="text-sm text-white/80">{t.subtitle}</p>
              <h3 className="mt-1 text-xl font-semibold sm:text-2xl">{t.title}</h3>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
                Shop now <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
