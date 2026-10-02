import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logPaymentEvent } from "@/lib/payments";

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "application/pdf": ".pdf",
};
const MAX_BYTES = 8 * 1024 * 1024;

// The customer submits their transfer reference and/or a receipt screenshot
// (reçu) after paying manually. Scoped to the order's owner.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const order = await prisma.order.findFirst({ where: { id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const reference = String(form.get("reference") ?? "").trim();
  const file = form.get("receipt");
  const hasFile = file instanceof File && file.size > 0;

  if (!reference && !hasFile) {
    return NextResponse.json(
      { error: "Add your transfer reference or a receipt screenshot." },
      { status: 400 }
    );
  }

  let receiptUrl: string | undefined;
  if (hasFile) {
    const f = file as File;
    const ext = ALLOWED[f.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Receipt must be an image (JPG, PNG, WebP) or PDF." },
        { status: 400 }
      );
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: "Receipt is too large (max 8 MB)." }, { status: 400 });
    }
    const bytes = Buffer.from(await f.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "receipts");
    mkdirSync(dir, { recursive: true });
    const name = `${order.id}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    writeFileSync(path.join(dir, name), bytes);
    receiptUrl = `/receipts/${name}`;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ...(reference ? { paymentRef: reference } : {}),
      ...(receiptUrl ? { receiptUrl } : {}),
    },
  });
  await logPaymentEvent(order.id, "prepay_submitted", {
    message:
      "Customer submitted payment proof" +
      (reference ? ` — ref: ${reference}` : "") +
      (receiptUrl ? " — receipt attached" : "") +
      ".",
  });

  return NextResponse.json({ ok: true, receiptUrl });
}
