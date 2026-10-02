import { NextResponse } from "next/server";
import { computeCoupon } from "@/lib/coupons";

// Preview a coupon's discount for a given subtotal (used by the cart).
export async function POST(req: Request) {
  let body: { code?: string; subtotalCents?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const subtotalCents = Number.isFinite(body.subtotalCents) ? Number(body.subtotalCents) : 0;
  const result = await computeCoupon(body.code ?? "", subtotalCents);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    code: result.code,
    description: result.description,
    discountCents: result.discountCents,
  });
}
