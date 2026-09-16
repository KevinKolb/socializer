import { env } from "@/lib/env";
import { PLANS, type Plan, type PlanId } from "@/lib/plans";
import type { Platform, Profile, Subscription } from "@/lib/types";

export interface Entitlement {
  plan: Plan;
  /** Stripe status when subscribed, "free" otherwise, "unlimited" when billing is off. */
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** True when this deployment has no Stripe configured (self-hosting / local dev). */
  billingDisabled: boolean;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Which plan a user is on right now.
 *  - Billing not configured -> Pro for everyone (local dev / self-hosting).
 *  - Active Stripe subscription -> Pro.
 *  - Otherwise -> Free (X only).
 */
export function getEntitlement(profile: Profile, sub: Subscription | null): Entitlement {
  void profile; // reserved for per-user overrides (e.g. comped accounts)

  if (!env.billingEnabled()) {
    return { plan: PLANS.pro, status: "unlimited", periodEnd: null, cancelAtPeriodEnd: false, billingDisabled: true };
  }

  if (sub && ACTIVE_STATUSES.has(sub.status)) {
    return {
      plan: PLANS.pro,
      status: sub.status,
      periodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      billingDisabled: false,
    };
  }

  return { plan: PLANS.free, status: "free", periodEnd: null, cancelAtPeriodEnd: false, billingDisabled: false };
}

export function planId(e: Entitlement): PlanId {
  return e.plan.id;
}

export function canPostTo(e: Entitlement, platform: Platform): boolean {
  return e.plan.platforms.includes(platform);
}

/** Effective daily card count: the user's preference capped by their plan. */
export function dailyCardLimit(e: Entitlement, profile: Profile): number {
  return Math.min(profile.daily_item_target, e.plan.maxDailyCards);
}
