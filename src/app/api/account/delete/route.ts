import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyPassword, destroySession } from "@/lib/auth";

// Permanently delete the current account.
export async function POST(req: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const dbUser = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!dbUser) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Confirm identity with the password for password-based accounts.
  if (dbUser.passwordHash) {
    const ok = await verifyPassword(body.password ?? "", dbUser.passwordHash);
    if (!ok) return NextResponse.json({ error: "Your password is wrong." }, { status: 400 });
  }

  // Keep past orders for records, but detach them from the deleted user.
  await prisma.order.updateMany({ where: { userId: dbUser.id }, data: { userId: null } });
  // Sessions, wishlist, addresses and messages cascade-delete with the user.
  await prisma.user.delete({ where: { id: dbUser.id } });
  await destroySession();

  return NextResponse.json({ ok: true });
}
