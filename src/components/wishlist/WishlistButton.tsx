"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

/**
 * Toggle a product in the wishlist.
 * - variant "heart": icon button (used on product pages)
 * - variant "remove": labelled button (used on the wishlist page)
 */
export function WishlistButton({
  productId,
  initialSaved,
  variant = "heart",
}: {
  productId: string;
  initialSaved: boolean;
  variant?: "heart" | "remove";
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setLoading(true);
    try {
      if (saved) {
        await fetch(`/api/wishlist?productId=${productId}`, { method: "DELETE" });
      } else {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
      }
      setSaved(!saved);
      if (variant === "remove") router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (variant === "remove") {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-danger disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        Remove
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border transition hover:bg-surface disabled:opacity-50"
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <Heart size={20} className={saved ? "fill-current text-danger" : "text-foreground"} />
      )}
    </button>
  );
}
