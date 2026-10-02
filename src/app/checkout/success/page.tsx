import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ClearCartOnMount } from "@/components/cart/ClearCartOnMount";

export const metadata = { title: "Order confirmed — Maximize" };

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <ClearCartOnMount />
      <CheckCircle2 size={64} className="text-success" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Thank you for your order!</h1>
      <p className="mt-3 text-muted">
        Your payment was successful and a confirmation is on its way to your inbox.
        You can track everything from your account.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/products"
          className="rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background hover:opacity-90"
        >
          Keep shopping
        </Link>
        <Link
          href="/"
          className="rounded-full border px-7 py-3 text-sm font-semibold hover:bg-surface"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
