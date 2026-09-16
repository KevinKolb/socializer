import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import type { Profile } from "@/lib/types";

/** POST /api/stripe/checkout - start a subscription Checkout session. */
export async function POST(request: NextRequest) {
  if (!env.billingEnabled()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) return NextResponse.json({ error: "Profile missing" }, { status: 400 });

  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await createAdminClient().from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: env.stripePriceId(), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${env.appUrl()}/app/billing?checkout=success`,
    cancel_url: `${env.appUrl()}/app/billing?checkout=cancelled`,
    subscription_data: { metadata: { supabase_user_id: user.id } },
  });

  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json({ url: session.url });
  }
  return NextResponse.redirect(session.url!, { status: 303 });
}
