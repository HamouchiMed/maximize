import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logPaymentEvent } from "@/lib/payments";

// Customer cancels an order before it's delivered. Soft cancel: keeps the
// record as "cancelled". If the order was paid (or a RIB is given), the refund
// process starts at "requested" so the customer is refunded to their RIB.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { reason?: string; rib?: string } = {};
  try {
    body = await req.json();
  } catch {
    // reason / rib are optional in the payload
  }
  const reason = String(body.reason ?? "").trim();
  const rib = String(body.rib ?? "").trim();

  const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === "refunded") {
    return NextResponse.json(
      { error: "This order is already refunded." },
      { status: 400 }
    );
  }
  if (order.status === "cancelled") {
    return NextResponse.json({ ok: true, status: "cancelled" });
  }
  if (order.fulfillmentStatus === "delivered") {
    return NextResponse.json(
      { error: "This order was already delivered and can't be cancelled." },
      { status: 400 }
    );
  }

  // If order was paid OR customer provided a RIB, start the refund process at "requested".
  const wasPaid = order.status === "paid";
  const startRefund = wasPaid || Boolean(rib);
  await prisma.order.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelReason: reason || null,
      refundRib: rib || null,
      refundStatus: startRefund ? "requested" : "none",
      refundStatusAt: startRefund ? new Date() : null,
    },
  });
  await logPaymentEvent(id, "cancelled", {
    message:
      "Customer cancelled the order" +
      (reason ? ` — reason: ${reason}` : "") +
      (rib ? ` — refund RIB: ${rib} (refund requested)` : "") +
      ".",
  });

  return NextResponse.json({ ok: true, status: "cancelled" });
}
