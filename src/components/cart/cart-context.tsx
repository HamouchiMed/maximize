"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

export interface CartItem {
  id: string; // product id
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  image: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

type Action =
  | { type: "ADD"; item: Omit<CartItem, "quantity">; quantity?: number }
  | { type: "REMOVE"; id: string }
  | { type: "SET_QTY"; id: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

const STORAGE_KEY = "maximize-cart-v1";

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items };
    case "ADD": {
      const qty = action.quantity ?? 1;
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, quantity: i.quantity + qty } : i
          ),
        };
      }
      return { items: [...state.items, { ...action.item, quantity: qty }] };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.id !== action.id) };
    case "SET_QTY":
      return {
        items: state.items
          .map((i) =>
            i.id === action.id ? { ...i, quantity: Math.max(0, action.quantity) } : i
          )
          .filter((i) => i.quantity > 0),
      };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  couponCode: string | null;
  discountCents: number;
  totalCents: number;
  applyCoupon: (code: string) => Promise<{ ok: boolean; error?: string }>;
  removeCoupon: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, quantity: number) => void;
  clear: () => void;
}

const COUPON_KEY = "maximize-coupon-v1";

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discountCents, setDiscountCents] = useState(0);

  const subtotalCents = useMemo(
    () => state.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    [state.items]
  );

  // Load persisted cart + coupon on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", items: JSON.parse(raw) });
      const savedCoupon = localStorage.getItem(COUPON_KEY);
      if (savedCoupon) setCouponCode(savedCoupon);
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  // Re-validate the applied coupon whenever the subtotal changes (a percent
  // coupon's value shifts, and it may fall below its minimum).
  useEffect(() => {
    if (!hydrated) return;
    if (!couponCode) {
      setDiscountCents(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: couponCode, subtotalCents }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setDiscountCents(data.discountCents ?? 0);
        } else {
          // No longer valid (e.g. below minimum) — drop it.
          setCouponCode(null);
          setDiscountCents(0);
          localStorage.removeItem(COUPON_KEY);
        }
      } catch {
        /* network hiccup — keep the last known discount */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [couponCode, subtotalCents, hydrated]);

  // Persist on change (after initial hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* storage may be unavailable */
    }
  }, [state.items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((n, i) => n + i.quantity, 0);
    const totalCents = Math.max(0, subtotalCents - discountCents);

    async function applyCoupon(code: string): Promise<{ ok: boolean; error?: string }> {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalCents }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error ?? "Invalid code." };
      setCouponCode(data.code);
      setDiscountCents(data.discountCents ?? 0);
      try {
        localStorage.setItem(COUPON_KEY, data.code);
      } catch {
        /* storage may be unavailable */
      }
      return { ok: true };
    }

    function removeCoupon() {
      setCouponCode(null);
      setDiscountCents(0);
      try {
        localStorage.removeItem(COUPON_KEY);
      } catch {
        /* storage may be unavailable */
      }
    }

    return {
      items: state.items,
      count,
      subtotalCents,
      couponCode,
      discountCents,
      totalCents,
      applyCoupon,
      removeCoupon,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      add: (item, quantity) => {
        // Login wall (Temu/AliExpress style): must be signed in to add to cart.
        if (!user) {
          const target = pathname ?? "/";
          router.push(`/login?redirect=${encodeURIComponent(target)}`);
          return;
        }
        dispatch({ type: "ADD", item, quantity });
        setIsOpen(true);
      },
      remove: (id) => dispatch({ type: "REMOVE", id }),
      setQty: (id, quantity) => dispatch({ type: "SET_QTY", id, quantity }),
      clear: () => {
        dispatch({ type: "CLEAR" });
        setCouponCode(null);
        setDiscountCents(0);
        try {
          localStorage.removeItem(COUPON_KEY);
        } catch {
          /* storage may be unavailable */
        }
      },
    };
  }, [state.items, isOpen, user, router, pathname, subtotalCents, couponCode, discountCents]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
