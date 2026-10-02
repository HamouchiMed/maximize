import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Save a profile picture as a data URL on the user record.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (!image.startsWith("data:image/")) {
    return NextResponse.json({ error: "Please choose an image file." }, { status: 400 });
  }
  // Base64 is ~1.33x the file size; ~2M chars ≈ 1.5 MB image.
  if (image.length > 2_000_000) {
    return NextResponse.json({ error: "Image is too large (max ~1.5 MB)." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { image },
  });
  return NextResponse.json({ image: updated.image });
}
