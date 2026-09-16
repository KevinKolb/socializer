/**
 * Central place for environment variables so a missing value fails loudly
 * with a useful message instead of an undefined somewhere deep in a request.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  appUrl: () => optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, ""),

  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  discoveryModel: () => optional("SOCIALIZER_DISCOVERY_MODEL", "claude-opus-5"),

  xClientId: () => required("X_CLIENT_ID"),
  xClientSecret: () => required("X_CLIENT_SECRET"),

  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  stripePriceId: () => required("STRIPE_PRICE_ID"),

  tokenEncryptionKey: () => required("TOKEN_ENCRYPTION_KEY"),

  /** True when Stripe is configured; lets the app run locally without billing. */
  billingEnabled: () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
};
