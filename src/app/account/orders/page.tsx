import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Truck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { OrderActions } from "@/components/account/OrderActions";

export const metadata = { title: "My orders — Maximize" };

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  paid: { text: "Paid", className: "border-success/60 bg-success/10 text-success" },
  pending: { text: "Pending", className: "border-warning/60 bg-warning/10 text-warning" },
  failed: { text: "Failed", className: "border-danger/60 bg-danger/10 text-danger" },
  cancelled: { text: "Cancelled", className: "border-danger/60 bg-danger/10 text-danger" },
  refunded: { text: "Refunded", className: "border-accent/60 bg-accent/10 text-accent" },
};

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/account/orders");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">My orders</h1>

      {orders.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <Package size={48} className="text-border" />
          <p className="mt-4 text-muted">You haven&apos;t placed any orders yet.</p>
          <Link
            href="/products"
            className="mt-6 rounded-full bg-foreground px-7 py-3 text-sm font-semibold text-background hover:opacity-90"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {orders.map((o) => {
            const statusConfig = STATUS_LABEL[o.status] ?? {
              text: o.status,
              className: "border-border text-muted",
            };
            const text =
              o.status === "cancelled" && o.refundStatus !== "none"
                ? `Cancelled · Refund ${o.refundStatus}`
                : statusConfig.text;
            return (
              <li key={o.id} className="rounded-2xl border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Order #{o.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(o.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusConfig.className}`}
                  >
                    {text}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex justify-between gap-3">
                      <span className="truncate text-muted">
                        {it.name} × {it.quantity}
                      </span>
                      <span className="flex-shrink-0">
                        {formatPrice(it.priceCents * it.quantity, o.currency)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-3 font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(o.amountTotal, o.currency)}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold hover:bg-surface"
                  >
                    <Truck size={15} /> Track order
                  </Link>
                  <OrderActions
                    orderId={o.id}
                    status={o.status}
                    fulfillmentStatus={o.fulfillmentStatus}
                    compact
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
