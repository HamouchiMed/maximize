"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Ticket,
  Truck,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { useAuth } from "@/components/auth/auth-context";

export interface NavCategory {
  name: string;
  slug: string;
  count: number;
}

export function Header({ categories }: { categories: NavCategory[] }) {
  const { count, openCart } = useCart();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?search=${encodeURIComponent(q)}` : "/products");
    setMobileOpen(false);
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-background/90 backdrop-blur transition-shadow ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      {/* Announcement bar */}
      <div className="bg-foreground text-background">
        <p className="mx-auto max-w-7xl px-4 py-2 text-center text-xs font-medium tracking-wide">
          Free shipping over 300 DH · Last-day deals up to 60% off · 30-day returns
        </p>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        {/* Mobile menu toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <Link href="/" className="text-xl font-bold tracking-tight">
          MAXIMIZE
        </Link>

        {/* Desktop nav */}
        <nav className="ml-6 hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium hover:text-accent">
            Home
          </Link>

          {/* Shop mega-menu */}
          <div
            className="relative"
            onMouseEnter={() => setShopOpen(true)}
            onMouseLeave={() => setShopOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm font-medium hover:text-accent">
              Shop <ChevronDown size={15} />
            </button>
            {shopOpen && (
              <div className="absolute left-0 top-full w-64 pt-3">
                <div className="rounded-xl border bg-background p-2 shadow-lg">
                  <Link
                    href="/products"
                    className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface"
                  >
                    All products
                  </Link>
                  <div className="my-1 border-t" />
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/products?category=${c.slug}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface"
                    >
                      {c.name}
                      <span className="text-xs text-muted">{c.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/products?sort=newest" className="text-sm font-medium hover:text-accent">
            New
          </Link>
          <Link href="/products?sort=price-asc" className="text-sm font-medium hover:text-accent">
            Deals
          </Link>
        </nav>

        {/* Search */}
        <form onSubmit={submitSearch} className="ml-auto hidden flex-1 max-w-xs md:block">
          <div className="flex items-center gap-2 rounded-full border bg-surface px-4 py-2">
            <Search size={16} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </form>

        {/* Account + Cart */}
        <div className="ml-auto flex items-center gap-4 md:ml-4">
          {/* Account */}
          {user ? (
            <div
              className="relative"
              onMouseEnter={() => setAcctOpen(true)}
              onMouseLeave={() => setAcctOpen(false)}
            >
              <button className="flex items-center gap-2 text-sm font-medium hover:text-accent">
                <User size={20} />
                <span className="hidden max-w-[8rem] truncate sm:inline">
                  {user.name || user.email.split("@")[0]}
                </span>
                <ChevronDown size={14} className="hidden sm:block" />
              </button>
              {acctOpen && (
                <div className="absolute right-0 top-full w-72 pt-2">
                  <div className="overflow-hidden rounded-2xl border bg-background shadow-lg">
                    {/* Welcome header */}
                    <div className="flex items-center gap-3 p-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-sm font-semibold uppercase text-accent">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (user.name || user.email).charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          Welcome back, {user.name || user.email.split("@")[0]}
                        </p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>

                    {/* Quick shortcuts */}
                    <div className="grid grid-cols-3 gap-1 px-3 pb-3">
                      <Link href="/account/orders" onClick={() => setAcctOpen(false)} className="flex flex-col items-center gap-1.5 rounded-lg py-2.5 hover:bg-surface">
                        <Package size={20} className="text-accent" />
                        <span className="text-xs">My orders</span>
                      </Link>
                      <Link href="/account/wishlist" onClick={() => setAcctOpen(false)} className="flex flex-col items-center gap-1.5 rounded-lg py-2.5 hover:bg-surface">
                        <Heart size={20} className="text-accent" />
                        <span className="text-xs">Wish list</span>
                      </Link>
                      <Link href="/account/coupons" onClick={() => setAcctOpen(false)} className="flex flex-col items-center gap-1.5 rounded-lg py-2.5 hover:bg-surface">
                        <Ticket size={20} className="text-accent" />
                        <span className="text-xs">Coupons</span>
                      </Link>
                    </div>

                    {/* List */}
                    <div className="border-t p-1.5">
                      {[
                        { icon: Truck, label: "Track order", href: "/account/orders" },
                        { icon: MapPin, label: "Shipping addresses", href: "/account/addresses" },
                        { icon: CreditCard, label: "Payment methods", href: "/account/payment" },
                        { icon: MessageCircle, label: "Messages", href: "/account/messages" },
                        { icon: Settings, label: "Account settings", href: "/account/settings" },
                        { icon: HelpCircle, label: "Help center", href: "/help" },
                      ].map(({ icon: Icon, label, href }) => (
                        <Link
                          key={label}
                          href={href}
                          onClick={() => setAcctOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface"
                        >
                          <Icon size={18} className="text-muted" /> {label}
                        </Link>
                      ))}
                    </div>

                    {/* Sign out */}
                    <div className="border-t p-1.5">
                      <button
                        onClick={async () => {
                          setAcctOpen(false);
                          await logout();
                          router.refresh();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger hover:bg-surface"
                      >
                        <LogOut size={18} /> Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium hover:text-accent">
                Log in
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background hover:opacity-90 sm:inline-block"
              >
                Sign up
              </Link>
            </div>
          )}

          {/* Cart */}
          <button
            onClick={openCart}
            className="relative flex items-center"
            aria-label="Open cart"
          >
            <ShoppingBag size={22} />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-foreground">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <form onSubmit={submitSearch} className="mb-4">
              <div className="flex items-center gap-2 rounded-full border bg-surface px-4 py-2">
                <Search size={16} className="text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </div>
            </form>
            <nav className="flex flex-col">
              <Link href="/" onClick={() => setMobileOpen(false)} className="py-2 font-medium">
                Home
              </Link>
              <Link
                href="/products"
                onClick={() => setMobileOpen(false)}
                className="py-2 font-medium"
              >
                All products
              </Link>
              <div className="my-1 border-t" />
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/products?category=${c.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  {c.name}
                  <span className="text-xs text-muted">{c.count}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
