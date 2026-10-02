export function getSiteUrl(req: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = configuredUrl || new URL(req.url).origin;

  return origin.replace(/\/+$/, "");
}

export function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  return value;
}

export function safeAuthScreen(value: string | null): "login" | "signup" {
  return value === "signup" ? "signup" : "login";
}
