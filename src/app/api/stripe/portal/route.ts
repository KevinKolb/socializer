import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import type { Profile } from "@/lib/types";

/** POST /api/stripe/portal - open the Stripe customer portal. */
export async function POST() {
  if (!env.billingEnabled()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile?.stripe_customer_id) {
    return NextResponse.redirect(`${env.appUrl()}/app/billing?portal=no_customer`, { status: 303 });
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${env.appUrl()}/app/billing`,
  });
  return NextResponse.redirect(session.url, { status: 303 });
}
