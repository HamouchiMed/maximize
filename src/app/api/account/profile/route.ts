import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Update the account name and/or preferred payment method.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { name?: string; preferredPayment?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: {
    name?: string | null;
    preferredPayment?: string;
    country?: string | null;
  } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || null;
  if (typeof body.country === "string") data.country = body.country.trim() || null;
  if (body.preferredPayment === "card" || body.preferredPayment === "cod") {
    data.preferredPayment = body.preferredPayment;
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({
    user: { id: updated.id, email: updated.email, name: updated.name },
  });
}
