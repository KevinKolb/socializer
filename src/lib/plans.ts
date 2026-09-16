import type { Platform } from "@/lib/types";

/**
 * Plan definitions. Free posts to X only; Pro unlocks every platform and a
 * bigger daily deck. Tune limits here (or via env) without touching logic.
 */
export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** Platforms this plan may post to. */
  platforms: readonly Platform[];
  /** Upper bound for "cards per day"; the user can choose less. */
  maxDailyCards: number;
  blurb: string;
}

/** Platforms the product knows about, including ones not built yet. */
export const PLATFORM_META: Record<
  Platform | "linkedin" | "threads" | "bluesky",
  { label: string; available: boolean; freeTier: boolean }
> = {
  x: { label: "X (Twitter)", available: true, freeTier: true },
  linkedin: { label: "LinkedIn", available: false, freeTier: false },
  threads: { label: "Threads", available: false, freeTier: false },
  bluesky: { label: "Bluesky", available: false, freeTier: false },
};

const FREE_DAILY_CARDS = Number(process.env.SOCIALIZER_FREE_DAILY_CARDS ?? "5") || 5;
const PRO_DAILY_CARDS = Number(process.env.SOCIALIZER_PRO_DAILY_CARDS ?? "40") || 40;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    platforms: ["x"],
    maxDailyCards: FREE_DAILY_CARDS,
    blurb: `Post to X. Up to ${FREE_DAILY_CARDS} candidates a day.`,
  },
  pro: {
    id: "pro",
    name: "Pro",
    platforms: ["x"], // every built platform; extend as platforms ship
    maxDailyCards: PRO_DAILY_CARDS,
    blurb: `Every platform we support, up to ${PRO_DAILY_CARDS} candidates a day, gather on demand.`,
  },
};
