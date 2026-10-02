import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { notFound, redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getPrepayInfo } from "@/lib/prepay";
import { PrepayFlow, type FlowMethod } from "@/components/checkout/PrepayFlow";

export const metadata = { title: "Complete your payment — Maximize" };

// Brand fallback badge (used until you drop a real logo in public/banks/).
const BRAND_STYLE: Record<string, { bg: string; short: string }> = {
  simple: { bg: "#F58220", short: "S" },
  attijari: { bg: "#F58220", short: "AW" },
  popular: { bg: "#8a5a1e", short: "BP" },
  cashplus: { bg: "#E30613", short: "C+" },
};

// If public/banks/<brand>.<ext> exists, use it as the logo; else null.
function bankLogo(brand: string): string | null {
  for (const ext of ["svg", "png", "webp", "jpg", "jpeg"]) {
    const rel = `banks/${brand}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", rel))) return `/${rel}`;
  }
  return null;
}

export default async function PrepayPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) redirect("/cart");

  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/checkout/prepay?order=${orderId}`);

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  const info = getPrepayInfo();
  const amount = formatPrice(order.amountTotal, order.currency);
  const alreadyPaid = order.status === "paid";

  // Resolve each method's logo/badge server-side and hand serializable data
  // to the interactive step flow.
  const flowMethods: FlowMethod[] = info.methods.map((m) => {
    const style = BRAND_STYLE[m.brand] ?? { bg: "#555", short: "•" };
    return {
      key: m.key,
      label: m.label,
      logo: bankLogo(m.brand),
      badgeBg: style.bg,
      badgeShort: style.short,
      big: m.brand === "popular" || m.brand === "attijari",
      lines: m.lines,
      note: m.note,
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        {alreadyPaid ? "Payment received 🎉" : "Complete your payment"}
      </h1>
      <p className="mt-2 text-muted">
        Order #{order.id.slice(-8).toUpperCase()} ·{" "}
        <span className="font-semibold text-foreground">{amount}</span>
      </p>

      {alreadyPaid ? (
        <div className="mt-6 rounded-2xl border border-success/40 bg-success/5 p-5 text-sm">
          We&apos;ve confirmed your payment and started preparing your order.
        </div>
      ) : !info.configured ? (
        <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/5 p-5 text-sm text-warning">
          Payment details are being set up. Please contact us to complete your
          payment, or check back shortly.
        </div>
      ) : (
        <PrepayFlow
          methods={flowMethods}
          orderId={order.id}
          amount={amount}
          initialRef={order.paymentRef}
          initialReceipt={order.receiptUrl}
        />
      )}

      {/* Items */}
      <div className="mt-4 rounded-2xl border p-5">
        <h2 className="text-sm font-semibold">Your order</h2>
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
          <span>Total to send</span>
          <span>{amount}</span>
        </div>
      </div>

      <Link
        href={`/account/orders/${order.id}`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        <Truck size={15} /> Track this order
      </Link>
    </div>
  );
}
