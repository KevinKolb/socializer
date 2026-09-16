import { describe, expect, it, beforeEach } from "vitest";
import type { Profile, Subscription } from "./types";

const profile: Profile = {
  id: "u1", email: "a@b.c", display_name: null, timezone: "UTC", daily_item_target: 20,
  voice: "v", stripe_customer_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};
const sub = (status: string): Subscription => ({
  user_id: "u1", stripe_subscription_id: "sub_1", status, price_id: "p", current_period_end: null,
  cancel_at_period_end: false, updated_at: new Date().toISOString(),
});

describe("entitlements", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_PRICE_ID = "price_x";
  });

  it("defaults to Free (X only, capped deck) without a subscription", async () => {
    const { getEntitlement, canPostTo, dailyCardLimit } = await import("./entitlements");
    const e = getEntitlement(profile, null);
    expect(e.plan.id).toBe("free");
    expect(canPostTo(e, "x")).toBe(true);
    expect(dailyCardLimit(e, profile)).toBe(e.plan.maxDailyCards);
  });

  it("is Pro with an active subscription", async () => {
    const { getEntitlement, dailyCardLimit } = await import("./entitlements");
    const e = getEntitlement(profile, sub("active"));
    expect(e.plan.id).toBe("pro");
    expect(dailyCardLimit(e, profile)).toBe(20);
  });

  it("drops back to Free when the subscription is canceled", async () => {
    const { getEntitlement } = await import("./entitlements");
    expect(getEntitlement(profile, sub("canceled")).plan.id).toBe("free");
  });

  it("treats everyone as Pro when billing is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getEntitlement } = await import("./entitlements");
    const e = getEntitlement(profile, null);
    expect(e.plan.id).toBe("pro");
    expect(e.billingDisabled).toBe(true);
  });
});
