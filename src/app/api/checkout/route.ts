import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeCoupon } from "@/lib/coupons";
import { logPaymentEvent } from "@/lib/payments";
import {
  createPaymentToken,
  isYouCanPayConfigured,
} from "@/lib/youcanpay";

interface IncomingItem {
  id: string;
  quantity: number;
}

export async function POST(req: Request) {
  // Login wall (server-side enforcement): must be signed in to check out.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please log in to complete your purchase." },
      { status: 401 }
    );
  }

  let body: {
    items?: IncomingItem[];
    couponCode?: string;
    addressId?: string;
    method?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // "prepaid" = manual bank/CashPlus transfer (no gateway); "card" = YouCan Pay.
  const method = body.method === "prepaid" ? "prepaid" : "card";

  const items = (body.items ?? []).filter(
    (i) => typeof i.id === "string" && Number.isFinite(i.quantity) && i.quantity > 0
  );

  if (items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  // A shipping address is required so we know where to deliver. Use the chosen
  // address if it belongs to the user, otherwise their default one.
  const shipTo = body.addressId
    ? await prisma.address.findFirst({ where: { id: body.addressId, userId: user.id } })
    : await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

  if (!shipTo) {
    return NextResponse.json(
      {
        error: "Please add a shipping address before checking out.",
        needAddress: true,
      },
      { status: 400 }
    );
  }

  // Re-fetch products server-side so prices can't be tampered with client-side.
  const ids = items.map((i) => i.id);
  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lineItems = items
    .map((i) => {
      const product = byId.get(i.id);
      if (!product) return null;
      const quantity = Math.min(i.quantity, Math.max(1, product.stock));
      return { product, quantity };
    })
    .filter((x): x is { product: (typeof products)[number]; quantity: number } => x !== null);

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No valid products in cart." }, { status: 400 });
  }

  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.product.priceCents * li.quantity,
    0
  );

  // Re-validate the coupon server-side (never trust the client's discount).
  let discountCents = 0;
  let couponCode: string | null = null;
  if (body.couponCode) {
    const coupon = await computeCoupon(body.couponCode, subtotal);
    if (coupon.ok) {
      discountCents = coupon.discountCents;
      couponCode = coupon.code;
    }
  }
  const amountTotal = Math.max(0, subtotal - discountCents);

  const currency = lineItems[0].product.currency;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Create a pending order first so we always have a record to reconcile against.
  const order = await prisma.order.create({
    data: {
      email: user.email,
      userId: user.id,
      amountTotal,
      discountCents,
      couponCode,
      currency,
      status: "pending",
      paymentMethod: method,
      shipName: shipTo.fullName,
      shipPhone: shipTo.phone,
      shipLine1: shipTo.line1,
      shipCity: shipTo.city,
      shipRegion: shipTo.region,
      items: {
        create: lineItems.map((li) => ({
          productId: li.product.id,
          name: li.product.name,
          priceCents: li.product.priceCents,
          quantity: li.quantity,
        })),
      },
    },
  });

  await logPaymentEvent(order.id, "created", {
    message: `Order created (pending) for ${user.email}`,
    amountCents: amountTotal,
  });

  // Manual prepayment (bank transfer / CashPlus): no gateway. The order waits
  // as "pending" until the admin confirms the money arrived.
  if (method === "prepaid") {
    return NextResponse.json({ orderId: order.id, prepaid: true });
  }

  if (!isYouCanPayConfigured) {
    return NextResponse.json(
      {
        error:
          "Checkout isn't configured yet. Add your YouCan Pay keys to .env.local " +
          "(YOUCAN_PAY_PRIVATE_KEY and NEXT_PUBLIC_YOUCAN_PAY_PUBLIC_KEY) to enable payments.",
        demo: true,
      },
      { status: 503 }
    );
  }

  try {
    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const customerIp = forwardedFor.split(",")[0]?.trim() || undefined;

    const { token, transactionId } = await createPaymentToken({
      orderId: order.id,
      amount: amountTotal, // already in minor units (centimes)
      currency: currency.toUpperCase(), // YouCan Pay wants "MAD", not "mad"
      successUrl: `${siteUrl}/checkout/success?order=${order.id}`,
      errorUrl: `${siteUrl}/checkout/cancel`,
      customerIp,
      metadata: { orderId: order.id },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { youcanTokenId: token, youcanTransactionId: transactionId || null },
    });

    await logPaymentEvent(order.id, "tokenized", {
      message: `Payment token created${transactionId ? ` (txn ${transactionId})` : ""}`,
      amountCents: amountTotal,
    });

    // The browser renders YouCan Pay's secure card form with this token.
    return NextResponse.json({ token, orderId: order.id });
  } catch (e) {
    console.error("YouCan Pay checkout error:", e);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "failed" },
    }).catch(() => {});
    await logPaymentEvent(order.id, "failed", {
      message: e instanceof Error ? e.message : "Could not start checkout.",
    });
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
