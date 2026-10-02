"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/cart-context";

/** Clears the cart once, after a successful checkout. */
export function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
