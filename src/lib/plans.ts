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
export type KnownPlatform =
  | Platform
  | "facebook"
  | "instagram"
  | "threads"
  | "linkedin"
  | "bluesky"
  | "mastodon"
  | "reddit"
  | "pinterest"
  | "tiktok"
  | "youtube";

export interface PlatformMeta {
  label: string;
  /** Short brand mark for icons. */
  mark: string;
  available: boolean;
  freeTier: boolean;
  /** What a post needs on this platform, when it is more than text. */
  note?: string;
}

export const PLATFORM_META: Record<KnownPlatform, PlatformMeta> = {
  x:         { label: "X (Twitter)",      mark: "X",  available: true,  freeTier: true },
  facebook:  { label: "Facebook Page",    mark: "f",  available: false, freeTier: false },
  instagram: { label: "Instagram",        mark: "IG", available: false, freeTier: false, note: "needs an image; we will generate one" },
  threads:   { label: "Threads",          mark: "@",  available: false, freeTier: false },
  linkedin:  { label: "LinkedIn",         mark: "in", available: false, freeTier: false },
  bluesky:   { label: "Bluesky",          mark: "bs", available: false, freeTier: false },
  mastodon:  { label: "Mastodon",         mark: "M",  available: false, freeTier: false },
  reddit:    { label: "Reddit",           mark: "r/", available: false, freeTier: false, note: "posts to a subreddit you choose" },
  pinterest: { label: "Pinterest",        mark: "P",  available: false, freeTier: false, note: "needs an image" },
  tiktok:    { label: "TikTok",           mark: "TT", available: false, freeTier: false, note: "needs a video or photo" },
  youtube:   { label: "YouTube Community",mark: "▶",  available: false, freeTier: false },
};

/** Platform ids in display order. */
export const KNOWN_PLATFORMS = Object.keys(PLATFORM_META) as KnownPlatform[];

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
