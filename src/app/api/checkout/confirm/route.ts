import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logPaymentEvent } from "@/lib/payments";

/**
 * Called by the browser after YouCan Pay's SDK reports a successful payment.
 * This gives the shopper an instant "paid" confirmation.
 *
 * NOTE: In production the authoritative "paid" signal is the `transaction.paid`
 * webhook (see /api/webhook), which YouCan Pay sends server-to-server and cannot
 * be spoofed. This route only promotes an order from `pending` -> `paid`, so a
 * webhook is still required to trust the payment for fulfilment.
 */
export async function POST(req: Request) {
  let body: { orderId?: string; transactionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orderId, transactionId } = body;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only promote a still-pending order; never downgrade an already-paid one.
  if (order.status === "pending") {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "paid",
        youcanTransactionId: transactionId ?? order.youcanTransactionId,
      },
    });
    await logPaymentEvent(orderId, "confirm_paid", {
      message: "Browser confirmed payment (instant, awaiting webhook to trust).",
      amountCents: order.amountTotal,
    });
  }

  return NextResponse.json({ ok: true, status: "paid" });
}
