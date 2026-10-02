import type { Platform } from "@/lib/types";

/**
 * Plan definitions. Free posts to X only; Pro unlocks every platform and a
 * bigger daily deck. Tune limits here (or via env) without touching logic.
 */
export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** Platforms this plan may post to (Postiz provider ids / "x"). */
  platforms: readonly string[];
  /** When true, every platform is allowed regardless of `platforms`. */
  allPlatforms: boolean;
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
  /** True when Socializer can publish a text post here (via Postiz). */
  available: boolean;
  freeTier: boolean;
  /** Postiz provider identifiers that map to this platform. */
  postiz: readonly string[];
  /** What a post needs on this platform, when it is more than text. */
  note?: string;
}

export const PLATFORM_META: Record<KnownPlatform, PlatformMeta> = {
  x:         { label: "X (Twitter)",      mark: "X",  available: true,  freeTier: true,  postiz: ["x"] },
  facebook:  { label: "Facebook Page",    mark: "f",  available: true,  freeTier: false, postiz: ["facebook"] },
  instagram: { label: "Instagram",        mark: "IG", available: false, freeTier: false, postiz: ["instagram", "instagram-standalone"], note: "needs an image" },
  threads:   { label: "Threads",          mark: "@",  available: true,  freeTier: false, postiz: ["threads"] },
  linkedin:  { label: "LinkedIn",         mark: "in", available: true,  freeTier: false, postiz: ["linkedin", "linkedin-page"] },
  bluesky:   { label: "Bluesky",          mark: "bs", available: true,  freeTier: false, postiz: ["bluesky"] },
  mastodon:  { label: "Mastodon",         mark: "M",  available: true,  freeTier: false, postiz: ["mastodon"] },
  reddit:    { label: "Reddit",           mark: "r/", available: false, freeTier: false, postiz: ["reddit"], note: "needs a subreddit and title" },
  pinterest: { label: "Pinterest",        mark: "P",  available: false, freeTier: false, postiz: ["pinterest"], note: "needs an image" },
  tiktok:    { label: "TikTok",           mark: "TT", available: false, freeTier: false, postiz: ["tiktok"], note: "needs a video or photo" },
  youtube:   { label: "YouTube",          mark: "▶",  available: false, freeTier: false, postiz: ["youtube"], note: "needs a video" },
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
    allPlatforms: false,
    maxDailyCards: FREE_DAILY_CARDS,
    blurb: `Post to X. Up to ${FREE_DAILY_CARDS} candidates a day.`,
  },
  pro: {
    id: "pro",
    name: "Pro",
    platforms: ["x"],
    allPlatforms: true,
    maxDailyCards: PRO_DAILY_CARDS,
    blurb: `Every platform we support, up to ${PRO_DAILY_CARDS} candidates a day, gather on demand.`,
  },
};
