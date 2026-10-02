"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { PromoCode } from "@/components/cart/PromoCode";
import { formatPrice } from "@/lib/format";

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    subtotalCents,
    couponCode,
    discountCents,
    totalCents,
    setQty,
    remove,
    count,
  } = useCart();
  const router = useRouter();

  // Go to the delivery-address step; the order is created there after the
  // customer confirms where to ship.
  function checkout() {
    closeCart();
    router.push("/checkout");
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={closeCart}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Shopping cart"
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShoppingBag size={20} /> Your Cart
            {count > 0 && <span className="text-muted">({count})</span>}
          </h2>
          <button
            onClick={closeCart}
            className="rounded-full p-2 hover:bg-surface"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={48} className="text-border" />
            <p className="text-muted">Your cart is empty.</p>
            <button
              onClick={closeCart}
              className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="flex flex-col gap-5">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeCart}
                      className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-surface"
                    >
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-2">
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={closeCart}
                          className="text-sm font-medium leading-snug hover:underline"
                        >
                          {item.name}
                        </Link>
                        <button
                          onClick={() => remove(item.id)}
                          className="text-muted hover:text-danger"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <span className="mt-1 text-sm text-muted">
                        {formatPrice(item.priceCents, item.currency)}
                      </span>
                      <div className="mt-auto flex items-center gap-3">
                        <div className="flex items-center rounded-full border">
                          <button
                            onClick={() => setQty(item.id, item.quantity - 1)}
                            className="p-1.5 hover:text-accent"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => setQty(item.id, item.quantity + 1)}
                            className="p-1.5 hover:text-accent"
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="ml-auto text-sm font-semibold">
                          {formatPrice(item.priceCents * item.quantity, item.currency)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="border-t px-5 py-4">
              <div className="mb-3">
                <PromoCode />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              {discountCents > 0 && (
                <div className="mt-1 flex items-center justify-between text-sm text-success">
                  <span>Discount{couponCode ? ` (${couponCode})` : ""}</span>
                  <span>−{formatPrice(discountCents)}</span>
                </div>
              )}
              <div className="mb-3 mt-2 flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="text-lg font-semibold">{formatPrice(totalCents)}</span>
              </div>
              <button
                onClick={checkout}
                className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
              >
                Checkout
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
