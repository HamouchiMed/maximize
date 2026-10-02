"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Loader2, Lock } from "lucide-react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_YOUCAN_PAY_PUBLIC_KEY ?? "";

// Minimal typing for the YouCan Pay browser SDK (loaded from their CDN).
type YcPayment = {
  mount: () => void;
  confirm: () => Promise<{
    status: string;
    transaction?: { id?: string } | string;
    error?: { message?: string };
  }>;
};
declare global {
  interface Window {
    yp?: (
      publicKey: string,
      opts?: { locale?: string; sandbox?: boolean }
    ) => { elements: (o: { token: string; container: string }) => YcPayment };
  }
}

// Sandbox keys look like `pub_sandbox_…`; tell the SDK so it uses test money.
const IS_SANDBOX = PUBLIC_KEY.includes("sandbox");

function PayInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const orderId = params.get("order");

  const [scriptReady, setScriptReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentRef = useRef<YcPayment | null>(null);

  // Build the secure card form once the SDK script is ready and we have a token.
  useEffect(() => {
    if (!scriptReady || !token || mounted) return;
    if (!window.yp) {
      setError("Payment form failed to load. Please refresh and try again.");
      return;
    }
    try {
      const payment = window.yp(PUBLIC_KEY, { locale: "en", sandbox: IS_SANDBOX }).elements({
        token,
        container: "#youcan-pay-form",
      });
      payment.mount();
      paymentRef.current = payment;
      setMounted(true);
    } catch (e) {
      console.error("YouCan Pay mount error:", e);
      setError("Could not display the payment form.");
    }
  }, [scriptReady, token, mounted]);

  async function pay() {
    if (!paymentRef.current) return;
    setPaying(true);
    setError(null);
    try {
      const result = await paymentRef.current.confirm();
      if (result.status === "succeeded") {
        const tx = result.transaction;
        const transactionId = typeof tx === "string" ? tx : tx?.id;
        // Tell our server to mark the order paid (webhook is the prod source of truth).
        await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, transactionId }),
        });
        router.push(`/checkout/success?order=${orderId ?? ""}`);
      } else {
        setError(result.error?.message ?? "Payment was not completed. Please try again.");
        setPaying(false);
      }
    } catch (e) {
      console.error("YouCan Pay confirm error:", e);
      setError("Something went wrong while processing your payment.");
      setPaying(false);
    }
  }

  if (!token || !orderId) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Nothing to pay for</h1>
        <p className="mt-3 text-muted">
          This payment link is missing information. Please go back to your cart and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Script
        src="https://youcanpay.com/yp.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError("Could not load the secure payment form.")}
      />

      <div className="rounded-2xl border p-6">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Lock size={18} /> Secure payment
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your card details are handled directly by YouCan Pay.
        </p>

        {/* YouCan Pay injects its card fields into this container. */}
        <div id="youcan-pay-form" className="mt-6 min-h-[120px]" />

        {!mounted && !error && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> Loading payment form…
          </p>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button
          onClick={pay}
          disabled={!mounted || paying}
          className="mt-6 w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {paying ? "Processing…" : "Pay now"}
        </button>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={null}>
      <PayInner />
    </Suspense>
  );
}
