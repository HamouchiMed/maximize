import { prisma } from "@/lib/prisma";

export interface CouponSuccess {
  ok: true;
  code: string;
  description: string;
  discountCents: number;
}
export interface CouponFailure {
  ok: false;
  error: string;
}

/**
 * Validate a coupon code against a subtotal and return the discount.
 * Used by both the cart (preview) and checkout (authoritative).
 */
export async function computeCoupon(
  codeRaw: string,
  subtotalCents: number
): Promise<CouponSuccess | CouponFailure> {
  const code = (codeRaw ?? "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) {
    return { ok: false, error: "That code isn't valid." };
  }
  if (subtotalCents < coupon.minSubtotalCents) {
    const min = (coupon.minSubtotalCents / 100).toLocaleString("en-US");
    return { ok: false, error: `This code needs a minimum of ${min} DH.` };
  }

  let discountCents =
    coupon.kind === "percent"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : coupon.value;
  discountCents = Math.min(discountCents, subtotalCents); // never exceed the order

  return { ok: true, code: coupon.code, description: coupon.description, discountCents };
}
