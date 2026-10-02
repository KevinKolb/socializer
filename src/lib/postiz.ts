/**
 * Postiz public API client.
 * Docs: https://docs.postiz.com/public-api
 *
 * Postiz holds the OAuth connections to every social network; Socializer only
 * needs the user's Postiz API key to list channels and publish to them.
 */

export const POSTIZ_DEFAULT_BASE_URL = "https://api.postiz.com";

export interface PostizIntegration {
  id: string;
  name: string;
  identifier: string;
  picture: string | null;
  disabled: boolean;
  profile: string | null;
  customer?: { id: string; name: string } | null;
}

export interface PostizCreateResult {
  postId: string;
  integration: string;
}

/** Providers Socializer can publish a plain text post to via Postiz. */
export const TEXT_CAPABLE_PROVIDERS = new Set([
  "x",
  "linkedin",
  "linkedin-page",
  "facebook",
  "threads",
  "bluesky",
  "mastodon",
  "telegram",
  "nostr",
  "vk",
  "warpcast",
]);

/** Character limits per provider for the composed post. */
export const PROVIDER_CHAR_LIMITS: Record<string, number> = {
  x: 280,
  bluesky: 300,
  threads: 500,
  mastodon: 500,
  warpcast: 320,
  nostr: 2000,
  telegram: 4096,
  vk: 4000,
  facebook: 5000,
  linkedin: 3000,
  "linkedin-page": 3000,
};

export const PROVIDER_LABELS: Record<string, string> = {
  x: "X",
  linkedin: "LinkedIn",
  "linkedin-page": "LinkedIn Page",
  facebook: "Facebook",
  instagram: "Instagram",
  "instagram-standalone": "Instagram",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  telegram: "Telegram",
  discord: "Discord",
  slack: "Slack",
  reddit: "Reddit",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  youtube: "YouTube",
  nostr: "Nostr",
  vk: "VK",
  warpcast: "Warpcast",
  lemmy: "Lemmy",
  medium: "Medium",
  devto: "Dev.to",
  hashnode: "Hashnode",
  wordpress: "WordPress",
  gmb: "Google Business",
  twitch: "Twitch",
  kick: "Kick",
  dribbble: "Dribbble",
  skool: "Skool",
  whop: "Whop",
  listmonk: "Listmonk",
};

export function providerLabel(identifier: string): string {
  return PROVIDER_LABELS[identifier] ?? identifier;
}

export function normalizeBaseUrl(input: string | null | undefined): string {
  const raw = (input ?? "").trim() || POSTIZ_DEFAULT_BASE_URL;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "").replace(/\/public\/v1$/, "");
}

export function apiKeyHint(key: string): string {
  return key.slice(-4);
}

async function request<T>(baseUrl: string, apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/public/v1${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "message" in json && String((json as { message: unknown }).message)) ||
      text.slice(0, 200) ||
      `HTTP ${res.status}`;
    throw new Error(`Postiz ${res.status}: ${msg}`);
  }
  return json as T;
}

export function listIntegrations(baseUrl: string, apiKey: string): Promise<PostizIntegration[]> {
  return request<PostizIntegration[]>(baseUrl, apiKey, "/integrations");
}

/** Provider-specific settings Postiz requires for a plain text post. */
export function settingsFor(identifier: string, sourceUrl: string | null): Record<string, unknown> {
  switch (identifier) {
    case "x":
      return {
        __type: "x",
        who_can_reply_post: "everyone",
        community: "",
        made_with_ai: false,
        paid_partnership: false,
      };
    case "linkedin":
    case "linkedin-page":
      return { __type: identifier, post_as_images_carousel: false };
    case "facebook":
      return { __type: "facebook", post_type: "post", ...(sourceUrl ? { url: sourceUrl } : {}) };
    default:
      return { __type: identifier };
  }
}

export interface PublishInput {
  integrationId: string;
  identifier: string;
  content: string;
  sourceUrl: string | null;
}

/** Publish one post to one channel right now. */
export async function publishNow(
  baseUrl: string,
  apiKey: string,
  input: PublishInput,
): Promise<PostizCreateResult> {
  const body = {
    type: "now",
    date: new Date().toISOString(),
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: input.integrationId },
        value: [{ content: input.content, image: [] }],
        settings: settingsFor(input.identifier, input.sourceUrl),
      },
    ],
  };
  const result = await request<PostizCreateResult[] | PostizCreateResult>(baseUrl, apiKey, "/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const first = Array.isArray(result) ? result[0] : result;
  if (!first || !first.postId) throw new Error("Postiz returned no post id");
  return first;
}
