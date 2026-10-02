"use client";

import { useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";

export interface CouponView {
  code: string;
  description: string;
}

export function CouponCards({ coupons }: { coupons: CouponView[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <ul className="mt-6 flex flex-col gap-4">
      {coupons.map((c) => (
        <li
          key={c.code}
          className="flex items-center gap-4 rounded-2xl border border-dashed p-5"
        >
          <Ticket size={28} className="flex-shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{c.code}</p>
            <p className="text-sm text-muted">{c.description}</p>
          </div>
          <button
            onClick={() => copy(c.code)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            {copied === c.code ? (
              <>
                <Check size={15} className="text-success" /> Copied
              </>
            ) : (
              <>
                <Copy size={15} /> Copy
              </>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
