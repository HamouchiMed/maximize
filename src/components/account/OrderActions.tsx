"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";

export function OrderActions({
  orderId,
  status,
  fulfillmentStatus,
  compact = false,
}: {
  orderId: string;
  status: string;
  fulfillmentStatus: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancel modal state
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [rib, setRib] = useState("");

  const isPaid = status === "paid";
  const isRefunded = status === "refunded";
  const isPending = status === "pending";
  const isCancelled = status === "cancelled";
  const delivered = fulfillmentStatus === "delivered";

  const canReceive = isPaid && !delivered;
  const canCancel = (isPending || isPaid) && !delivered && !isCancelled && !isRefunded; // allow cancelling paid or pending orders before delivery
  const canDelete = status === "failed" || isCancelled; // remove leftovers

  async function confirmReceived() {
    if (!confirm("Confirm that you received this order?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/received`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not update the order.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function openCancel() {
    setReason("");
    setRib("");
    setError(null);
    setShowCancel(true);
  }

  async function submitCancel() {
    if (!reason.trim()) {
      setError("Please tell us why you're cancelling.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, rib }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not cancel the order.");
      setShowCancel(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOrder() {
    if (!confirm("Delete this order? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not delete the order.");
      router.push("/account/orders");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const cancelModal = showCancel && (
    <div
      onClick={() => !busy && setShowCancel(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border bg-background p-6 text-left"
      >
        <h3 className="text-lg font-bold">Cancel this order</h3>
        <p className="mt-1 text-sm text-muted">
          Order #{orderId.slice(-8).toUpperCase()}
        </p>

        <label className="mt-4 block text-sm font-semibold">Why are you cancelling?</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. ordered by mistake, changed my mind…"
          className="mt-1 min-h-[80px] w-full rounded-lg border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
        />

        <label className="mt-4 block text-sm font-semibold">
          Your RIB <span className="font-normal text-muted">(only if you already paid)</span>
        </label>
        <input
          value={rib}
          onChange={(e) => setRib(e.target.value)}
          placeholder="24-digit RIB"
          className="mt-1 w-full rounded-lg border bg-surface px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-muted">
          If you already sent the money, add your RIB so we can send it back.
        </p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setShowCancel(false)}
            disabled={busy}
            className="rounded-full border px-4 py-2.5 text-sm font-semibold hover:bg-surface disabled:opacity-60"
          >
            Keep order
          </button>
          <button
            onClick={submitCancel}
            disabled={busy}
            className="rounded-full bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Cancelling…" : "Confirm cancellation"}
          </button>
        </div>
      </div>
    </div>
  );

  // ---- Compact: small buttons next to "Track order" in the orders list ----
  if (compact) {
    return (
      <>
        {canReceive && (
          <button
            onClick={confirmReceived}
            disabled={busy}
            title="I received my order"
            className="flex items-center gap-1 rounded-full bg-success px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <CheckCircle2 size={14} /> Received
          </button>
        )}
        {delivered && (
          <span className="flex items-center gap-1 rounded-full border border-success/40 px-3 py-2 text-xs font-semibold text-success">
            <CheckCircle2 size={14} /> Received
          </span>
        )}
        {isRefunded && (
          <span className="flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold text-muted">
            Refunded
          </span>
        )}
        {canCancel && (
          <button
            onClick={openCancel}
            disabled={busy}
            title="Cancel order"
            className="flex items-center gap-1 rounded-full border border-danger px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger/5 disabled:opacity-60"
          >
            <XCircle size={14} /> Cancel
          </button>
        )}
        {canDelete && (
          <button
            onClick={deleteOrder}
            disabled={busy}
            title="Delete order"
            className="flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold text-muted transition hover:bg-surface disabled:opacity-60"
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
        {cancelModal}
      </>
    );
  }

  // ---- Full: buttons on the order tracking page ----
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        {canReceive && (
          <button
            onClick={confirmReceived}
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-success px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <CheckCircle2 size={16} /> I received my order
          </button>
        )}
        {canCancel && (
          <button
            onClick={openCancel}
            disabled={busy}
            className="flex items-center gap-2 rounded-full border border-danger px-5 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/5 disabled:opacity-60"
          >
            <XCircle size={16} /> Cancel order
          </button>
        )}
        {canDelete && (
          <button
            onClick={deleteOrder}
            disabled={busy}
            className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface disabled:opacity-60"
          >
            <Trash2 size={16} /> Delete order
          </button>
        )}
      </div>
      {isCancelled && (
        <p className="mt-3 text-sm font-medium text-muted">This order was cancelled.</p>
      )}
      {delivered && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 size={16} /> You confirmed you received this order.
        </p>
      )}
      {isRefunded && (
        <p className="mt-3 text-sm font-medium text-muted">This order was refunded.</p>
      )}
      {error && !showCancel && <p className="mt-2 text-sm text-danger">{error}</p>}
      {cancelModal}
    </div>
  );
}
