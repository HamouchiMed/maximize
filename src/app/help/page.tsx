import Link from "next/link";

export const metadata = { title: "Help center — Maximize" };

const FAQ = [
  {
    q: "How long does delivery take?",
    a: "Orders are processed within 1–2 business days and typically arrive within 3–7 days depending on your city. You'll see delivery details at checkout.",
  },
  {
    q: "How much is shipping?",
    a: "Shipping is free on orders over 300 DH. Below that, the fee is calculated at checkout based on your address.",
  },
  {
    q: "How can I pay?",
    a: "You can pay securely by card (Visa / Mastercard) through YouCan Pay. You can set your preferred method under Account → Payment methods.",
  },
  {
    q: "Can I return an item?",
    a: "Yes — we offer 30-day returns on most items. Contact us through the Messages page with your order number and we'll help you start a return.",
  },
  {
    q: "How do I track my order?",
    a: "Go to Account → My orders to see the status of every order you've placed.",
  },
  {
    q: "How do I use a coupon?",
    a: "Copy a code from Account → My coupons, then paste it into the promo code box in your cart before checking out.",
  },
  {
    q: "I forgot my password.",
    a: "You can set a new password anytime from Account → Settings while logged in. A full reset-by-email flow is on the way.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Help center</h1>
      <p className="mt-1 text-sm text-muted">
        Answers to common questions. Still stuck?{" "}
        <Link href="/account/messages" className="font-medium text-accent hover:underline">
          Send us a message
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {FAQ.map((item) => (
          <details key={item.q} className="rounded-2xl border p-5">
            <summary className="cursor-pointer font-medium">{item.q}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
