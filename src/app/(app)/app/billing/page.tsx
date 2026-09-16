import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { env } from "@/lib/env";
import { KNOWN_PLATFORMS, PLANS, PLATFORM_META } from "@/lib/plans";
import type { Profile, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("subscriptions").select("*").eq("user_id", user!.id).maybeSingle<Subscription>(),
  ]);
  if (!profile) return null;

  const e = getEntitlement(profile, sub ?? null);
  const isPro = e.plan.id === "pro";
  const comingSoon = KNOWN_PLATFORMS.filter((k) => !PLATFORM_META[k].available).map((k) => PLATFORM_META[k].label);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted">Free posts to X. Pro unlocks everything. Cancel anytime.</p>
      </div>

      {sp.checkout === "success" && (
        <p className="rounded-lg bg-success/10 p-3 text-sm text-success">
          Thanks! Your subscription is active. It can take a few seconds to show up here.
        </p>
      )}
      {sp.checkout === "cancelled" && (
        <p className="rounded-lg bg-background p-3 text-sm text-muted">Checkout cancelled.</p>
      )}

      <div className="card">
        <p className="label">Current plan</p>
        {e.billingDisabled ? (
          <p className="text-sm">Billing is not configured on this deployment. Everyone gets Pro.</p>
        ) : (
          <p className="text-sm">
            <span className="font-medium">{e.plan.name}</span>
            {isPro && (
              <>
                {" "}· {e.status}
                {e.periodEnd && (
                  <> · {e.cancelAtPeriodEnd ? "ends" : "renews"} {new Date(e.periodEnd).toLocaleDateString()}</>
                )}
              </>
            )}
          </p>
        )}
        {env.billingEnabled() && (
          <div className="mt-4">
            {isPro ? (
              <form action="/api/stripe/portal" method="post">
                <button className="btn-secondary">Manage subscription</button>
              </form>
            ) : (
              <form action="/api/stripe/checkout" method="post">
                <button className="btn-primary">Upgrade to Pro</button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {([PLANS.free, PLANS.pro] as const).map((plan) => (
          <div key={plan.id} className={`card ${e.plan.id === plan.id ? "ring-2 ring-accent" : ""}`}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{plan.name}</h2>
              {e.plan.id === plan.id && <span className="text-xs text-muted">current</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>· Up to {plan.maxDailyCards} candidates a day</li>
              <li>· Drafts written in your voice</li>
              <li>· X (Twitter)</li>
              {plan.id === "pro" ? (
                <li>· Every platform as it ships: {comingSoon.join(", ")}</li>
              ) : (
                <li className="text-muted">· Other platforms need Pro</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
