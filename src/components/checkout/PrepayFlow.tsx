"use client";

import { useState } from "react";
import { ChevronRight, ArrowLeft, Copy, Check } from "lucide-react";
import { PrepayRefForm } from "@/components/checkout/PrepayRefForm";

export interface FlowMethod {
  key: string;
  label: string;
  logo: string | null;
  badgeBg: string;
  badgeShort: string;
  big: boolean;
  lines: { k: string; v: string; mono?: boolean }[];
  note?: string;
}

function Logo({ m, size }: { m: FlowMethod; size: string }) {
  if (m.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={m.logo}
        alt={m.label}
        className={`${size} flex-shrink-0 rounded-md object-contain`}
      />
    );
  }
  return (
    <span
      className={`flex ${size} flex-shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white`}
      style={{ backgroundColor: m.badgeBg }}
    >
      {m.badgeShort}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value.replace(/\s+/g, ""));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted hover:bg-surface"
      aria-label="Copy"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function PrepayFlow({
  methods,
  orderId,
  amount,
  initialRef,
  initialReceipt,
}: {
  methods: FlowMethod[];
  orderId: string;
  amount: string;
  initialRef: string | null;
  initialReceipt: string | null;
}) {
  // If there's only one method, jump straight to its details.
  const [selectedKey, setSelectedKey] = useState<string | null>(
    methods.length === 1 ? methods[0].key : null
  );
  const selected = methods.find((m) => m.key === selectedKey) ?? null;

  if (!selected) {
    // Step 1 — choose a bank (logo + name only, no RIB).
    return (
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Step 1 of 2
        </p>
        <h2 className="mt-1 text-lg font-semibold">Choose how to pay {amount}</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a bank or CashPlus — you&apos;ll get the account number on the next step.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedKey(m.key)}
              className="flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:border-accent hover:bg-surface"
            >
              <Logo m={m} size={m.big ? "h-14 w-14" : "h-11 w-11"} />
              <span className="flex-1 font-medium">{m.label}</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2 + 3 — show the chosen bank's details, then the reference form.
  return (
    <div className="mt-6">
      <button
        onClick={() => setSelectedKey(null)}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={15} /> Choose a different method
      </button>

      <div className="mt-3 rounded-2xl border p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Step 2 of 2 · send {amount}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Logo m={selected} size={selected.big ? "h-16 w-16" : "h-12 w-12"} />
          <h2 className="text-lg font-semibold">{selected.label}</h2>
        </div>

        <dl className="mt-4 flex flex-col gap-3">
          {selected.lines.map((ln, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <dt className="text-xs text-muted">{ln.k}</dt>
                <dd className={`break-all ${ln.mono ? "font-mono text-sm" : "font-semibold"}`}>
                  {ln.v}
                </dd>
              </div>
              {ln.mono && <CopyButton value={ln.v} />}
            </div>
          ))}
        </dl>
        {selected.note && <p className="mt-3 text-xs text-muted">{selected.note}</p>}

        <p className="mt-4 rounded-lg bg-surface/60 p-3 text-xs text-muted">
          Send exactly <span className="font-semibold text-foreground">{amount}</span> to the
          account above, then confirm below. We ship as soon as we receive it.
        </p>
      </div>

      <div className="mt-4">
        <PrepayRefForm orderId={orderId} initialRef={initialRef} initialReceipt={initialReceipt} />
      </div>
    </div>
  );
}
