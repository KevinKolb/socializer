/** Row types mirroring supabase/migrations/0001_init.sql */

export type Platform = "x";

export type ItemStatus = "pending" | "skipped" | "approved" | "posted" | "failed";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  timezone: string;
  daily_item_target: number;
  voice: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interest {
  id: string;
  user_id: string;
  topic: string;
  guidance: string | null;
  sources: string[];
  active: boolean;
  created_at: string;
}

/** The columns a browser/authenticated client is allowed to read. */
export interface PlatformConnectionPublic {
  id: string;
  user_id: string;
  platform: Platform;
  enabled: boolean;
  platform_user_id: string | null;
  platform_username: string | null;
  token_expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface PlatformConnection extends PlatformConnectionPublic {
  access_token_enc: string;
  refresh_token_enc: string | null;
}

/** A user's handle on a platform, recorded whether or not posting is wired up yet. */
export interface PlatformAccount {
  user_id: string;
  platform: string;
  username: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  user_id: string;
  interest_id: string | null;
  batch_date: string;
  title: string;
  summary: string;
  source_url: string | null;
  source_name: string | null;
  why_relevant: string | null;
  suggested_post: string;
  hashtags: string[];
  status: ItemStatus;
  decided_at: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content_item_id: string;
  platform: Platform;
  platform_post_id: string | null;
  posted_text: string;
  status: "posted" | "failed";
  error: string | null;
  posted_at: string;
}

export interface GatherRun {
  id: string;
  user_id: string;
  trigger: "cron" | "manual";
  status: "running" | "done" | "failed";
  items_created: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface Subscription {
  user_id: string;
  stripe_subscription_id: string | null;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
}

export const PUBLIC_CONNECTION_COLUMNS =
  "id, user_id, platform, enabled, platform_user_id, platform_username, token_expires_at, scopes, created_at, updated_at";
