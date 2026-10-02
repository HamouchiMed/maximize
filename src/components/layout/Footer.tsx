import Link from "next/link";
import { Camera, MessageCircle, Globe, Video } from "lucide-react";
import type { NavCategory } from "@/components/layout/Header";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "New arrivals", href: "/products?sort=newest" },
      { label: "Best sellers", href: "/products?sort=rating" },
      { label: "Deals", href: "/products?category=audio" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact us", href: "#" },
      { label: "Shipping & returns", href: "#" },
      { label: "Track your order", href: "#" },
      { label: "FAQ", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Sustainability", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
    ],
  },
];

export function Footer({ categories }: { categories: NavCategory[] }) {
  return (
    <footer className="mt-20 border-t bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link href="/" className="text-xl font-bold tracking-tight">
            MAXIMIZE
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">
            Thoughtfully designed gear for work, play, and everything in between.
            Fast shipping, easy returns, and support that actually helps.
          </p>
          <div className="mt-5 flex gap-3">
            {[Camera, MessageCircle, Globe, Video].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full border bg-background hover:text-accent"
                aria-label="Social link"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-semibold">{col.title}</h3>
            <ul className="flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="mb-3 text-sm font-semibold">Categories</h3>
          <ul className="flex flex-col gap-2">
            {categories.slice(0, 5).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="text-sm text-muted hover:text-foreground"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Maximize Store. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
