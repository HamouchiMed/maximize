"use client";

import { useState } from "react";
import { Loader2, MapPin, Trash2 } from "lucide-react";

export interface AddressView {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  city: string;
  region: string | null;
  isDefault: boolean;
}

const inputClass =
  "rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent";

export function AddressManager({ initial }: { initial: AddressView[] }) {
  const [addresses, setAddresses] = useState<AddressView[]>(initial);
  const [form, setForm] = useState({ fullName: "", phone: "", line1: "", city: "", region: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save address.");
      setAddresses((a) => [...a, data.address]);
      setForm({ fullName: "", phone: "", line1: "", city: "", region: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setAddresses((a) => a.filter((x) => x.id !== id));
    await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {addresses.length > 0 && (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-2xl border p-4">
              <MapPin size={18} className="mt-0.5 flex-shrink-0 text-accent" />
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {a.fullName}{" "}
                  {a.isDefault && (
                    <span className="ml-1 rounded-full border border-accent px-2 py-0.5 text-xs text-accent">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-muted">{a.phone}</p>
                <p className="text-muted">
                  {a.line1}, {a.city}
                  {a.region ? `, ${a.region}` : ""}
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="flex items-center gap-1 text-sm text-muted hover:text-danger"
              >
                <Trash2 size={15} /> Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="rounded-2xl border p-5">
        <h2 className="font-semibold">Add a new address</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="Full name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          <input className={inputClass} placeholder="Phone number" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <input className={`${inputClass} sm:col-span-2`} placeholder="Address (street, building, apt)" value={form.line1} onChange={(e) => set("line1", e.target.value)} />
          <input className={inputClass} placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <input className={inputClass} placeholder="Region (optional)" value={form.region} onChange={(e) => set("region", e.target.value)} />
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Save address
        </button>
      </form>
    </div>
  );
}
