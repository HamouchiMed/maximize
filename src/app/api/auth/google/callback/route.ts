import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { getSiteUrl, safeAuthScreen, safeRedirectPath } from "@/lib/oauth";

// Step 2 of Google login: Google redirects back here with a code; we exchange it
// for the user's profile, create/link the account, and start a session.
export async function GET(req: Request) {
  const siteUrl = getSiteUrl(req);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const jar = await cookies();
  const savedState = jar.get("oauth_state")?.value;
  const redirectTo = safeRedirectPath(jar.get("oauth_redirect")?.value ?? null);
  const screen = safeAuthScreen(jar.get("oauth_screen")?.value ?? null);
  jar.delete("oauth_state");
  jar.delete("oauth_redirect");
  jar.delete("oauth_screen");

  const fail = (reason: string) =>
    NextResponse.redirect(`${siteUrl}/${screen}?error=${reason}`);

  if (!clientId || !clientSecret) return fail("google_not_configured");
  if (!code || !state || !savedState || state !== savedState) return fail("google_failed");

  try {
    // Exchange the authorization code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${siteUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token exchange failed");
    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const tokenExpiry =
      typeof tokens.expires_in === "number"
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

    // Fetch the user's basic profile.
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) throw new Error("userinfo failed");
    const profile = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const email = String(profile.email ?? "").toLowerCase();
    const googleId = String(profile.sub ?? "");
    if (!email || !googleId) throw new Error("missing profile fields");

    // Link by googleId, or by an existing email account, otherwise create new.
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId,
          name: profile.name ?? null,
          image: profile.picture ?? null,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          name: user.name ?? profile.name ?? null,
          image: user.image ?? profile.picture ?? null,
        },
      });
    }

    // Persist the latest tokens on every login. A refresh token is only returned
    // the first time (or when re-consented), so keep the existing one otherwise.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: tokens.access_token ?? null,
        googleTokenExpiry: tokenExpiry,
        ...(tokens.refresh_token
          ? { googleRefreshToken: tokens.refresh_token }
          : {}),
      },
    });

    await createSession(user.id);
    return NextResponse.redirect(`${siteUrl}${redirectTo}`);
  } catch (e) {
    console.error("Google OAuth error:", e);
    return fail("google_failed");
  }
}
