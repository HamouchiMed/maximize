"use client";

import { useRef, useState } from "react";
import { Check, Upload, FileText } from "lucide-react";

export function PrepayRefForm({
  orderId,
  initialRef,
  initialReceipt,
}: {
  orderId: string;
  initialRef: string | null;
  initialReceipt?: string | null;
}) {
  const [reference, setReference] = useState(initialRef ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialRef || initialReceipt));
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim() && !file) {
      setError("Enter your transfer reference or attach the receipt screenshot.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("reference", reference);
      if (file) body.append("receipt", file);
      const res = await fetch(`/api/orders/${orderId}/payment-ref`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your payment proof.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/5 p-5">
        <p className="flex items-center gap-2 font-semibold text-success">
          <Check size={18} /> Thanks — we got your payment proof
        </p>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll confirm your transfer and start preparing your order. You can
          follow it any time on your order tracking page.
        </p>
        <button
          onClick={() => setSaved(false)}
          className="mt-3 text-sm text-accent hover:underline"
        >
          Update reference or receipt
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Step 3 · confirm your payment
      </p>
      <label className="mt-2 block text-sm font-semibold">
        After you send the money, add your transfer reference and/or receipt
      </label>
      <p className="mt-1 text-xs text-muted">
        e.g. the CashPlus transfer number, the bank reference, or the exact name
        you sent it from — plus a screenshot (reçu) of the transfer so we can
        match your payment quickly.
      </p>

      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Transfer reference / sender name"
        className="mt-3 w-full rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
      />

      {/* Receipt upload */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted hover:border-accent hover:text-foreground"
      >
        {file ? (
          <>
            <FileText size={16} /> {file.name}
          </>
        ) : (
          <>
            <Upload size={16} /> Attach receipt screenshot (reçu)
          </>
        )}
      </button>
      {file && (
        <button
          type="button"
          onClick={() => {
            setFile(null);
            if (fileInput.current) fileInput.current.value = "";
          }}
          className="mt-1 text-xs text-muted hover:text-danger"
        >
          Remove attachment
        </button>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Sending…" : "I've sent the payment"}
      </button>
    </form>
  );
}
