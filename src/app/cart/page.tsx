"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { PromoCode } from "@/components/cart/PromoCode";
import { formatPrice } from "@/lib/format";

export default function CartPage() {
  const router = useRouter();
  const { items, subtotalCents, couponCode, discountCents, totalCents, setQty, remove } =
    useCart();

  // The delivery address is collected on the next step (/checkout).
  function goToCheckout() {
    router.push("/checkout");
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <ShoppingBag size={56} className="text-border" />
        <h1 className="mt-6 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted">Let&apos;s find something you&apos;ll love.</p>
        <Link
          href="/products"
          className="mt-6 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background hover:opacity-90"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Your cart</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 py-5">
              <Link
                href={`/products/${item.slug}`}
                className="relative h-28 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-surface"
              >
                <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <Link href={`/products/${item.slug}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <span className="font-semibold">
                    {formatPrice(item.priceCents * item.quantity, item.currency)}
                  </span>
                </div>
                <span className="mt-1 text-sm text-muted">
                  {formatPrice(item.priceCents, item.currency)} each
                </span>
                <div className="mt-auto flex items-center gap-4">
                  <div className="flex items-center rounded-full border">
                    <button onClick={() => setQty(item.id, item.quantity - 1)} className="p-2 hover:text-accent" aria-label="Decrease">
                      <Minus size={14} />
                    </button>
                    <span className="w-9 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => setQty(item.id, item.quantity + 1)} className="p-2 hover:text-accent" aria-label="Increase">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="flex items-center gap-1 text-sm text-muted hover:text-danger"
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatPrice(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="mt-2 flex justify-between text-sm text-success">
                <span>Discount{couponCode ? ` (${couponCode})` : ""}</span>
                <span>−{formatPrice(discountCents)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Shipping</span>
              <span>{subtotalCents >= 30000 ? "Free" : "Calculated at checkout"}</span>
            </div>
            <div className="mt-4">
              <PromoCode />
            </div>
            <div className="my-4 border-t" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(totalCents)}</span>
            </div>
            <button
              onClick={goToCheckout}
              className="mt-6 w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              Proceed to checkout
            </button>
            <Link
              href="/products"
              className="mt-3 block text-center text-sm text-muted hover:text-foreground"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
