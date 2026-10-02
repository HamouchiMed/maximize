import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Add a product to the wishlist.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const productId = body.productId;
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    create: { userId: user.id, productId },
    update: {},
  });
  return NextResponse.json({ ok: true, saved: true });
}

// Remove a product from the wishlist (?productId=...).
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const productId = new URL(req.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
  return NextResponse.json({ ok: true, saved: false });
}
