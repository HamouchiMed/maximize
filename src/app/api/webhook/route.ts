import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logPaymentEvent } from "@/lib/payments";

/**
 * YouCan Pay webhook. This is the authoritative, server-to-server signal that a
 * payment really happened. Register this URL in the YouCan Pay dashboard
 * (Settings) once your site is deployed on a public HTTPS domain.
 *
 * Event we care about: `transaction.paid`. The payload carries our `order_id`
 * (which we set to our Order.id when tokenizing).
 *
 * Docs: https://developer.youcan.shop/youcan-pay/webhooks
 */
export async function POST(req: Request) {
  let event: {
    event_name?: string;
    sandbox?: boolean;
    payload?: Record<string, unknown>;
  };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event_name !== "transaction.paid") {
    // Acknowledge other events so YouCan Pay doesn't retry them.
    return NextResponse.json({ received: true });
  }

  const payload = event.payload ?? {};
  // The order id may arrive at the top level or nested under an order/metadata object.
  const orderId =
    (payload.order_id as string | undefined) ??
    ((payload.order as { id?: string } | undefined)?.id) ??
    ((payload.metadata as { orderId?: string } | undefined)?.orderId);
  const transactionId =
    (payload.transaction_id as string | undefined) ??
    (payload.id as string | undefined);

  if (!orderId) {
    console.error("YouCan Pay webhook: could not find order id in payload", payload);
    return NextResponse.json({ received: true });
  }

  try {
    const result = await prisma.order.updateMany({
      where: { id: orderId },
      data: { status: "paid", youcanTransactionId: transactionId ?? undefined },
    });
    if (result.count > 0) {
      await logPaymentEvent(orderId, "webhook_paid", {
        message: `Payment confirmed by YouCan Pay webhook${transactionId ? ` (txn ${transactionId})` : ""}.`,
      });
    }
  } catch (e) {
    console.error("Failed to mark order paid from webhook:", e);
  }

  return NextResponse.json({ received: true });
}
