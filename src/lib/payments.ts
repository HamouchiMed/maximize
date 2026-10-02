import { prisma } from "@/lib/prisma";

export type PaymentEventType =
  | "created"
  | "tokenized"
  | "confirm_paid"
  | "webhook_paid"
  | "prepay_submitted"
  | "manual_paid"
  | "received"
  | "refund_requested"
  | "cancelled"
  | "failed"
  | "refunded";

interface LogOptions {
  message?: string;
  provider?: string;
  amountCents?: number | null;
}

/**
 * Append a step to an order's payment audit trail. Best-effort: logging must
 * never break the checkout/webhook flow, so failures are swallowed and logged.
 */
export async function logPaymentEvent(
  orderId: string,
  type: PaymentEventType,
  opts: LogOptions = {}
): Promise<void> {
  try {
    await prisma.paymentEvent.create({
      data: {
        orderId,
        type,
        message: opts.message ?? null,
        provider: opts.provider ?? "youcanpay",
        amountCents: opts.amountCents ?? null,
      },
    });
  } catch (e) {
    console.error("Failed to log payment event", { orderId, type }, e);
  }
}
