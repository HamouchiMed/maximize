"use client";

import { useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";

export function PromoCode() {
  const { couponCode, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await applyCoupon(code.trim());
    if (!res.ok) setError(res.error ?? "Invalid code.");
    else setCode("");
    setLoading(false);
  }

  if (couponCode) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Tag size={15} className="text-success" />
          Code <span className="font-semibold">{couponCode}</span> applied
        </span>
        <button onClick={removeCoupon} aria-label="Remove code" className="text-muted hover:text-danger">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={apply} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Promo code"
          className="flex-1 rounded-lg border bg-surface px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : "Apply"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
