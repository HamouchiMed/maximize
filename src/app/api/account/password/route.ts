import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

// Change the account password.
export async function POST(req: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { current?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const current = body.current ?? "";
  const next = body.next ?? "";
  if (next.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (!user.passwordHash) {
    // Google-only account setting a password for the first time.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(next) },
    });
    return NextResponse.json({ ok: true });
  }

  if (!(await verifyPassword(current, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password is wrong." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return NextResponse.json({ ok: true });
}
