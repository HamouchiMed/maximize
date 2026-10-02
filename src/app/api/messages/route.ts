import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Send a support message.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const subject = body.subject?.trim() ?? "";
  const text = body.body?.trim() ?? "";
  if (!subject || !text) {
    return NextResponse.json({ error: "Please add a subject and a message." }, { status: 400 });
  }

  const message = await prisma.supportMessage.create({
    data: { userId: user.id, subject, body: text },
  });
  return NextResponse.json({ message });
}
