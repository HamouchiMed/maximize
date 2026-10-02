"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Heart,
  HelpCircle,
  Home,
  MapPin,
  MessageCircle,
  Package,
  Settings,
  Ticket,
  UserCircle,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";

const MENU_ITEMS = [
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/wishlist", label: "Wish list", icon: Heart },
  { href: "/account/coupons", label: "Coupons", icon: Ticket },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/payment", label: "Payment", icon: CreditCard },
  { href: "/account/messages", label: "Messages", icon: MessageCircle },
  { href: "/account/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help center", icon: HelpCircle },
];

export function AccountSidebar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const displayName = user?.name || user?.email.split("@")[0] || "My account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="lg:sticky lg:top-28">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
        <div className="flex items-center gap-3 border-b p-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-sm font-bold text-accent">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted">{user?.email ?? "Account center"}</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-2 no-scrollbar lg:flex-col">
          <Link
            href="/"
            className="flex flex-shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
          >
            <Home size={18} /> Store home
          </Link>

          {MENU_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/80 hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 hidden rounded-2xl border bg-background p-4 text-sm text-muted shadow-sm lg:block">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <UserCircle size={18} />
          Buyer center
        </div>
        <p className="mt-2 leading-5">
          Track orders, manage payments, update addresses, and contact support from one place.
        </p>
      </div>
    </aside>
  );
}
