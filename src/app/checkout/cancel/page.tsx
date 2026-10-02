import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata = { title: "Checkout canceled — Maximize" };

export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <XCircle size={64} className="text-muted" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Checkout canceled</h1>
      <p className="mt-3 text-muted">
        No worries — your cart is still saved. You can pick up right where you left off.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/cart"
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          Return to cart
        </Link>
        <Link
          href="/products"
          className="rounded-full border px-7 py-3 text-sm font-semibold hover:bg-surface"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
