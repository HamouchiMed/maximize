import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/**
 * Server-side Stripe client. Returns `null` when no secret key is configured
 * so the app can run in "demo mode" (browse + cart) without Stripe set up.
 */
export const stripe: Stripe | null = key ? new Stripe(key) : null;

export const isStripeConfigured = Boolean(key);
