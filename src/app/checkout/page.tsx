"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Lock, ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { formatPrice } from "@/lib/format";

interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  city: string;
  region: string | null;
  isDefault: boolean;
}

type FormFields = { fullName: string; phone: string; line1: string; city: string; region: string };
const emptyForm: FormFields = { fullName: "", phone: "", line1: "", city: "Agadir", region: "" };

const inputClass =
  "w-full rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent";

export default function CheckoutAddressPage() {
  const router = useRouter();
  const { items, subtotalCents, couponCode, discountCents, totalCents } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(true);
  // Either an existing address id, or "new" to type a fresh one.
  const [choice, setChoice] = useState<string>("new");
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the customer's saved addresses (redirect to login if not signed in).
  useEffect(() => {
    fetch("/api/addresses")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login?redirect=/checkout");
          return null;
        }
        return r.ok ? r.json() : { addresses: [] };
      })
      .then((d) => {
        if (!d) return;
        const list: Address[] = d.addresses ?? [];
        setAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        setChoice(def ? def.id : "new");
      })
      .catch(() => {})
      .finally(() => setLoadingAddr(false));
  }, [router]);

  function setField(field: keyof FormFields, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormFields, string>> = {};
    if (!form.fullName.trim()) next.fullName = "Please enter the full name.";
    const digits = form.phone.replace(/\D/g, "");
    if (!form.phone.trim()) next.phone = "Please enter a phone number.";
    else if (digits.length < 6) next.phone = "Enter a valid phone number.";
    if (!form.line1.trim()) next.line1 = "Please enter the delivery address.";
    if (!form.city.trim()) next.city = "Please enter the city.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    let addressId = choice;

    // If typing a new address, validate + save it first (registers the info).
    if (choice === "new") {
      if (!validate()) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save your address.");
        addressId = data.address.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your address.");
        setSubmitting(false);
        return;
      }
    } else {
      setSubmitting(true);
    }

    // Create the order + payment token, then go to the secure payment page.
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          couponCode,
          addressId,
          method: "prepaid",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
      // Manual prepayment: go to the instructions page to send the transfer.
      if (data.prepaid && data.orderId) {
        window.location.href = `/checkout/prepay?order=${encodeURIComponent(data.orderId)}`;
      } else if (data.token && data.orderId) {
        // Card path (YouCan Pay), kept for when the store is registered.
        window.location.href = `/checkout/pay?token=${encodeURIComponent(
          data.token
        )}&order=${encodeURIComponent(data.orderId)}`;
      } else {
        throw new Error(data.error ?? "Checkout failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <ShoppingBag size={56} className="text-border" />
        <h1 className="mt-6 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted">Add something before checking out.</p>
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
      {/* Steps */}
      <ol className="mb-8 flex items-center gap-3 text-sm">
        <li className="flex items-center gap-1.5 text-muted">
          <Check size={16} className="text-success" /> Cart
        </li>
        <span className="text-border">→</span>
        <li className="font-semibold text-foreground">Delivery address</li>
        <span className="text-border">→</span>
        <li className="flex items-center gap-1.5 text-muted">
          <Lock size={14} /> Payment
        </li>
      </ol>

      <h1 className="mb-8 text-3xl font-bold tracking-tight">Where should we deliver?</h1>

      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Address */}
        <div className="flex flex-col gap-4">
          {loadingAddr ? (
            <p className="text-sm text-muted">Loading your saved addresses…</p>
          ) : (
            <>
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm ${
                    choice === a.id ? "border-accent ring-1 ring-accent" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="choice"
                    className="mt-0.5"
                    checked={choice === a.id}
                    onChange={() => setChoice(a.id)}
                  />
                  <span>
                    <span className="font-medium">{a.fullName}</span> · {a.phone}
                    {a.isDefault && (
                      <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                        Default
                      </span>
                    )}
                    <br />
                    <span className="text-muted">
                      {a.line1}, {a.city}
                      {a.region ? `, ${a.region}` : ""}
                    </span>
                  </span>
                </label>
              ))}

              {/* New address option */}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm ${
                  choice === "new" ? "border-accent ring-1 ring-accent" : ""
                }`}
              >
                <input
                  type="radio"
                  name="choice"
                  checked={choice === "new"}
                  onChange={() => setChoice("new")}
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin size={15} /> Use a new address
                </span>
              </label>

              {choice === "new" && (
                <div className="grid gap-3 rounded-2xl border p-5">
                  {(
                    [
                      ["fullName", "Full name"],
                      ["phone", "Phone number"],
                      ["line1", "Address (street, building, etc.)"],
                      ["city", "City"],
                      ["region", "Region / area (optional)"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="mb-1 block text-sm font-medium">{label}</label>
                      <input
                        value={form[field]}
                        onChange={(e) => setField(field, e.target.value)}
                        className={`${inputClass} ${errors[field] ? "border-danger ring-1 ring-danger" : ""}`}
                        placeholder={label}
                      />
                      {errors[field] && (
                        <p className="mt-1 text-xs text-danger">{errors[field]}</p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted">
                    This store delivers within Agadir. Your details are saved to your account for next time.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Summary + continue */}
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="text-muted">
                    {i.name} × {i.quantity}
                  </span>
                  <span>{formatPrice(i.priceCents * i.quantity, i.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="my-4 border-t" />
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatPrice(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="mt-2 flex justify-between text-sm text-success">
                <span>Discount{couponCode ? ` (${couponCode})` : ""}</span>
                <span>−{formatPrice(discountCents)}</span>
              </div>
            )}
            <div className="mt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(totalCents)}</span>
            </div>

            <div className="mt-4 rounded-lg border bg-surface/50 p-3 text-xs text-muted">
              <span className="font-medium text-foreground">Payment:</span> bank
              transfer / CashPlus. You&apos;ll get the payment details on the next
              step, and we ship once we confirm your transfer.
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting || loadingAddr}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Please wait…" : "Continue to payment"}
              {!submitting && <Lock size={15} />}
            </button>
            <Link
              href="/cart"
              className="mt-3 block text-center text-sm text-muted hover:text-foreground"
            >
              Back to cart
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
