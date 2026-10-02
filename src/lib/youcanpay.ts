// YouCan Pay integration helpers (server-side).
//
// Flow: the server calls the `tokenize` endpoint with the PRIVATE key to create
// a one-time payment token for an order. The browser then renders YouCan Pay's
// secure card form with that token + the PUBLIC key (see /checkout/pay), so raw
// card numbers never touch our server. Docs: https://developer.youcan.shop/youcan-pay

const PRIVATE_KEY = process.env.YOUCAN_PAY_PRIVATE_KEY;

/** Public key is safe to expose to the browser (NEXT_PUBLIC_*). */
export const YOUCAN_PUBLIC_KEY = process.env.NEXT_PUBLIC_YOUCAN_PAY_PUBLIC_KEY ?? "";

/** Sandbox keys look like `pub_sandbox_…` / `pri_sandbox_…` (fake money). */
export const isSandbox =
  process.env.YOUCAN_PAY_SANDBOX === "true" ||
  (PRIVATE_KEY?.startsWith("pri_sandbox_") ?? false);

/** True only when both keys are present, so the app can run without them. */
export const isYouCanPayConfigured = Boolean(PRIVATE_KEY && YOUCAN_PUBLIC_KEY);

// Sandbox keys must hit the sandbox endpoint, otherwise YouCan Pay rejects with
// "Sandbox key used on live mode".
const TOKENIZE_URL = isSandbox
  ? "https://youcanpay.com/sandbox/api/tokenize"
  : "https://youcanpay.com/api/tokenize";

export interface TokenizeArgs {
  orderId: string;
  /** Amount in the currency's smallest unit (centimes for MAD). */
  amount: number;
  /** ISO-4217 code in uppercase, e.g. "MAD". */
  currency: string;
  successUrl: string;
  errorUrl: string;
  customerIp?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentToken {
  token: string;
  transactionId: string;
}

/**
 * Create a one-time payment token for an order.
 * Throws with a readable message if YouCan Pay rejects the request.
 */
export async function createPaymentToken(args: TokenizeArgs): Promise<PaymentToken> {
  if (!PRIVATE_KEY) {
    throw new Error("YouCan Pay is not configured (missing YOUCAN_PAY_PRIVATE_KEY).");
  }

  const res = await fetch(TOKENIZE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      pri_key: PRIVATE_KEY,
      order_id: args.orderId,
      amount: args.amount,
      currency: args.currency,
      success_url: args.successUrl,
      error_url: args.errorUrl,
      // YouCan Pay expects a customer IP; fall back to loopback in local dev.
      customer_ip: args.customerIp || "127.0.0.1",
      metadata: args.metadata ?? {},
    }),
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok || !data) {
    const reason =
      (data?.message as string) ?? (data?.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`YouCan Pay tokenize failed: ${reason}`);
  }

  // The token can be a plain string ("cp…") or an object { id: "…" } depending
  // on the API version. Normalize to the string the browser SDK expects.
  const rawToken = data.token as string | { id?: string } | undefined;
  const token =
    typeof rawToken === "string" ? rawToken : rawToken?.id ?? undefined;

  if (!token) {
    const reason =
      (data.message as string) ?? (data.error as string) ?? `HTTP ${res.status}`;
    throw new Error(`YouCan Pay tokenize failed: ${reason}`);
  }

  const transactionId =
    (data.transaction_id as string | undefined) ??
    (typeof rawToken === "object" ? rawToken?.id : undefined) ??
    "";

  return { token, transactionId };
}
