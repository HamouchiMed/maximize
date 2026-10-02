import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logPaymentEvent } from "@/lib/payments";

// Customer confirms they received their order → marks it delivered.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.fulfillmentStatus !== "delivered") {
    await prisma.order.update({
      where: { id },
      data: {
        fulfillmentStatus: "delivered",
        deliveredAt: order.deliveredAt ?? new Date(),
      },
    });
    await logPaymentEvent(id, "received", {
      message: "Customer confirmed they received the order.",
    });
  }

  return NextResponse.json({ ok: true });
}
