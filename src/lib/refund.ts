// Customer cancellation → money-back process. Ordered stages the customer sees
// and the admin advances. "rejected" is a terminal alternative to "sent".

export const REFUND_STAGES = ["requested", "reviewing", "processing", "sent"] as const;
export type RefundStage = (typeof REFUND_STAGES)[number] | "rejected" | "none";

export const REFUND_LABELS: Record<
  Exclude<RefundStage, "none">,
  { title: string; desc: string }
> = {
  requested: {
    title: "Cancellation received",
    desc: "We got your cancellation and refund request.",
  },
  reviewing: {
    title: "Checking your payment",
    desc: "We're verifying the transfer you made.",
  },
  processing: {
    title: "Refund being sent",
    desc: "We're sending the money back to your RIB.",
  },
  sent: {
    title: "Refund sent",
    desc: "Your money has been sent back to your RIB.",
  },
  rejected: {
    title: "Refund not applicable",
    desc: "We couldn't match a payment to refund. We'll be in touch.",
  },
};

export function isRefundStage(v: string): v is Exclude<RefundStage, "none"> {
  return v in REFUND_LABELS;
}
