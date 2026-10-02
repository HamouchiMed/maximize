import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Customer deletes their own order. Only unpaid orders (pending/failed) can be
// removed — paid/refunded orders are kept for records; those need support.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === "paid" || order.status === "refunded") {
    return NextResponse.json(
      { error: "Paid orders can't be deleted. Contact support to cancel." },
      { status: 400 }
    );
  }

  // PaymentEvents cascade on order delete; order items must be removed first.
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: id } }),
    prisma.order.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
