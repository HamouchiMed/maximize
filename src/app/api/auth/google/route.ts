import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSiteUrl, safeAuthScreen, safeRedirectPath } from "@/lib/oauth";

// Step 1 of Google login: redirect the user to Google's consent screen.
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = getSiteUrl(req);
  const { searchParams } = new URL(req.url);
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const screen = safeAuthScreen(searchParams.get("screen"));

  if (!clientId) {
    return NextResponse.redirect(`${siteUrl}/${screen}?error=google_not_configured`);
  }

  // CSRF protection: random state echoed back by Google and checked in the callback.
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  jar.set("oauth_state", state, cookieOpts);
  jar.set("oauth_redirect", redirectTo, cookieOpts);
  jar.set("oauth_screen", screen, cookieOpts);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    // Ask for a refresh token so the stored access token can be renewed.
    access_type: "offline",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
