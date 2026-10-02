import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin, Package, CreditCard, Box, Truck, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { OrderActions } from "@/components/account/OrderActions";
import { REFUND_STAGES, REFUND_LABELS } from "@/lib/refund";

export const metadata = { title: "Track order — Maximize" };

const STAGE_ORDER = ["awaiting", "ordered", "shipped", "delivered"] as const;

function fmtDate(d: Date | null | undefined) {
  return d
    ? new Date(d).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
}

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/account/orders/${id}`);

  // Scope to the signed-in user so people can only track their own orders.
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  const paid = order.status === "paid" || order.status === "refunded";
  const stageIndex = STAGE_ORDER.indexOf(
    (order.fulfillmentStatus as (typeof STAGE_ORDER)[number]) ?? "awaiting"
  );

  // Build the customer-facing timeline. Each step is "done", "current", or "todo".
  const steps = [
    {
      key: "placed",
      title: "Order placed",
      icon: Package,
      done: true,
      at: fmtDate(order.createdAt),
      note: `Order #${order.id.slice(-8).toUpperCase()}`,
    },
    {
      key: "paid",
      title: paid ? "Payment confirmed" : "Awaiting payment",
      icon: CreditCard,
      done: paid,
      at: null,
      note: paid ? "We received your payment." : "Your payment is still pending.",
    },
    {
      key: "preparing",
      title: "Preparing your order",
      icon: Box,
      done: stageIndex >= 1,
      at: null,
      note: "We're getting your item ready to ship.",
    },
    {
      key: "shipped",
      title: "Shipped",
      icon: Truck,
      done: stageIndex >= 2,
      at: fmtDate(order.shippedAt),
      note:
        order.trackingNumber
          ? `Tracking: ${order.trackingNumber}${order.carrier ? ` · ${order.carrier}` : ""}`
          : "On its way to you.",
    },
    {
      key: "delivered",
      title: "Delivered",
      icon: CheckCircle2,
      done: stageIndex >= 3,
      at: fmtDate(order.deliveredAt),
      note: stageIndex >= 3 ? "Your order was delivered." : "Almost there!",
    },
  ];
  // The first not-done step is the "current" one.
  const currentKey = steps.find((s) => !s.done)?.key;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/account/orders"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to my orders
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        {order.status === "cancelled" ? "Order cancelled" : "Track order"} #
        {order.id.slice(-8).toUpperCase()}
      </h1>

      {/* Refund process (shown when a money-back is in progress). */}
      {order.refundStatus !== "none" && (
        <div className="mt-5 rounded-2xl border p-5">
          <h2 className="text-lg font-semibold">Your refund</h2>
          {order.refundStatus === "rejected" ? (
            <div className="mt-3 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm">
              <p className="font-semibold text-danger">{REFUND_LABELS.rejected.title}</p>
              <p className="mt-1 text-muted">
                {order.refundNote || REFUND_LABELS.rejected.desc}
              </p>
            </div>
          ) : (
            <ol className="mt-4">
              {REFUND_STAGES.map((s, i) => {
                const currentIdx = (REFUND_STAGES as readonly string[]).indexOf(
                  order.refundStatus
                );
                const done = i <= currentIdx;
                const isCurrent = i === currentIdx;
                const last = i === REFUND_STAGES.length - 1;
                return (
                  <li key={s} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                          done
                            ? "border-success bg-success text-white"
                            : isCurrent
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-border text-border"
                        }`}
                      >
                        {done ? <CheckCircle2 size={15} /> : i + 1}
                      </span>
                      {!last && (
                        <span
                          className={`w-0.5 flex-1 ${done ? "bg-success" : "bg-border"}`}
                          style={{ minHeight: 22 }}
                        />
                      )}
                    </div>
                    <div className={last ? "" : "pb-5"}>
                      <p className={`text-sm font-semibold ${isCurrent ? "text-accent" : ""}`}>
                        {REFUND_LABELS[s].title}
                      </p>
                      <p className="text-xs text-muted">{REFUND_LABELS[s].desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {order.refundRib && (
            <p className="mt-3 text-xs text-muted">
              Refund to RIB:{" "}
              <span className="font-mono text-foreground">{order.refundRib}</span>
            </p>
          )}
          {order.refundStatusAt && (
            <p className="text-xs text-muted">Updated {fmtDate(order.refundStatusAt)}</p>
          )}
        </div>
      )}

      {/* Where is it now — the location the admin sets by hand. */}
      {order.status !== "cancelled" &&
        (order.currentLocation ? (
          <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/5 p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <MapPin size={16} /> Where is it now
            </p>
            <p className="mt-1 text-lg font-medium">{order.currentLocation}</p>
            {order.locationUpdatedAt && (
              <p className="mt-1 text-xs text-muted">
                Updated {fmtDate(order.locationUpdatedAt)}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border bg-surface/50 p-5 text-sm text-muted">
            No location update yet — we&apos;ll show your parcel&apos;s location here as soon as it ships.
          </p>
        ))}

      {/* Timeline */}
      {order.status !== "cancelled" && (
      <ol className="mt-8">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isCurrent = s.key === currentKey;
          const last = i === steps.length - 1;
          return (
            <li key={s.key} className="flex gap-4">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    s.done
                      ? "border-success bg-success text-white"
                      : isCurrent
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-border"
                  }`}
                >
                  <Icon size={18} />
                </span>
                {!last && (
                  <span
                    className={`w-0.5 flex-1 ${s.done ? "bg-success" : "bg-border"}`}
                    style={{ minHeight: 28 }}
                  />
                )}
              </div>
              {/* Text */}
              <div className={`pb-8 ${last ? "pb-0" : ""}`}>
                <p className={`font-semibold ${isCurrent ? "text-accent" : ""}`}>
                  {s.title}
                </p>
                {s.at && <p className="text-xs text-muted">{s.at}</p>}
                <p className="mt-0.5 text-sm text-muted">{s.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
      )}

      {/* Customer actions: confirm received / delete */}
      <OrderActions
        orderId={order.id}
        status={order.status}
        fulfillmentStatus={order.fulfillmentStatus}
      />

      {/* Delivery address */}
      {order.shipLine1 && (
        <div className="mt-4 rounded-2xl border p-5">
          <h2 className="text-sm font-semibold">Delivery address</h2>
          <p className="mt-2 text-sm text-muted">
            {order.shipName}
            {order.shipPhone ? ` · ${order.shipPhone}` : ""}
            <br />
            {order.shipLine1}, {order.shipCity}
            {order.shipRegion ? `, ${order.shipRegion}` : ""}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="mt-4 rounded-2xl border p-5">
        <h2 className="text-sm font-semibold">Items</h2>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3">
              <span className="truncate text-muted">
                {it.name} × {it.quantity}
              </span>
              <span className="flex-shrink-0">
                {formatPrice(it.priceCents * it.quantity, order.currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.amountTotal, order.currency)}</span>
        </div>
      </div>
    </div>
  );
}
