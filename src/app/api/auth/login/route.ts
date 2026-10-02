import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message whether the email or the password is wrong (avoids leaking which).
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
