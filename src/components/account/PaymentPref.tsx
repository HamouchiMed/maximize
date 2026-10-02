"use client";

import { useState } from "react";
import { Banknote, Check, CreditCard, Loader2 } from "lucide-react";

const OPTIONS = [
  {
    id: "card",
    icon: CreditCard,
    title: "Card (Visa / Mastercard)",
    desc: "Entered securely at checkout via YouCan Pay. Card details are never stored.",
  },
  {
    id: "cod",
    icon: Banknote,
    title: "Cash on delivery",
    desc: "Pay in cash when your order arrives.",
  },
] as const;

export function PaymentPref({ initial }: { initial: string | null }) {
  const [selected, setSelected] = useState<string>(initial ?? "card");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function choose(id: string) {
    if (id === selected) return;
    setSelected(id);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredPayment: id }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {OPTIONS.map((o) => {
        const active = selected === o.id;
        return (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            className={`flex items-start gap-3 rounded-2xl border p-5 text-left transition hover:bg-surface ${
              active ? "border-accent ring-1 ring-accent" : ""
            }`}
          >
            <o.icon size={22} className="mt-0.5 flex-shrink-0 text-accent" />
            <div className="flex-1">
              <p className="font-medium">{o.title}</p>
              <p className="mt-0.5 text-sm text-muted">{o.desc}</p>
            </div>
            {active && <Check size={20} className="flex-shrink-0 text-accent" />}
          </button>
        );
      })}
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saved ? "Saved as your default." : "This is your default payment method."}
      </p>
    </div>
  );
}
