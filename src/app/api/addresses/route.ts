import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// List the signed-in user's shipping addresses (default first).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ addresses });
}

// Add a shipping address.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: {
    fullName?: string;
    phone?: string;
    line1?: string;
    city?: string;
    region?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const fullName = body.fullName?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const line1 = body.line1?.trim() ?? "";
  const city = body.city?.trim() ?? "";
  const region = body.region?.trim() || null;

  if (!fullName || !phone || !line1 || !city) {
    return NextResponse.json(
      { error: "Name, phone, address and city are required." },
      { status: 400 }
    );
  }

  // First address becomes the default.
  const count = await prisma.address.count({ where: { userId: user.id } });
  const address = await prisma.address.create({
    data: { userId: user.id, fullName, phone, line1, city, region, isDefault: count === 0 },
  });
  return NextResponse.json({ address });
}

// Delete an address (?id=...).
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // deleteMany with userId guard so users can only delete their own.
  await prisma.address.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
