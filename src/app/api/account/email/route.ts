import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyPassword } from "@/lib/auth";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Change the account email address.
export async function POST(req: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { newEmail?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const newEmail = (body.newEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(newEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!dbUser) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (newEmail === dbUser.email) {
    return NextResponse.json({ error: "That's already your email." }, { status: 400 });
  }

  // Require the current password for password-based accounts.
  if (dbUser.passwordHash) {
    const ok = await verifyPassword(body.password ?? "", dbUser.passwordHash);
    if (!ok) return NextResponse.json({ error: "Your password is wrong." }, { status: 400 });
  }

  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken) {
    return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: dbUser.id },
    data: { email: newEmail },
  });
  return NextResponse.json({ email: updated.email });
}
