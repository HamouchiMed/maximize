import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, derivedKey) =>
      err ? reject(err) : resolve(derivedKey)
    );
  });
}

/** Hash a password as `salt:hash` using scrypt (no external dependency). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time verify of a password against a stored `salt:hash`. */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = await scryptAsync(password, salt);
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

/** Create a DB session for a user and set the HTTP-only session cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Delete the current session (DB row + cookie). */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    jar.delete(SESSION_COOKIE);
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/**
 * Resolve the logged-in user from the session cookie, or null.
 * Safe to call from server components, route handlers, and layouts.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, image: u.image };
}
