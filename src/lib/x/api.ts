import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/x/oauth";
import type { PlatformConnection } from "@/lib/types";

const API = "https://api.x.com/2";

export interface XUser {
  id: string;
  name: string;
  username: string;
}

export async function fetchMe(accessToken: string): Promise<XUser> {
  const res = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: XUser; detail?: string; title?: string };
  if (!res.ok || !json.data) {
    throw new Error(`X /users/me failed (${res.status}): ${json.detail ?? json.title ?? "unknown"}`);
  }
  return json.data;
}

/**
 * Returns a valid access token for the connection, refreshing (and persisting)
 * it when it is within 2 minutes of expiring.
 */
export async function getValidAccessToken(conn: PlatformConnection): Promise<string> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const soon = Date.now() + 2 * 60 * 1000;

  if (expiresAt > soon) return decrypt(conn.access_token_enc);

  if (!conn.refresh_token_enc) {
    throw new Error("X access token expired and no refresh token is stored. Reconnect X.");
  }

  const refreshed = await refreshAccessToken(decrypt(conn.refresh_token_enc));
  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_connections")
    .update({
      access_token_enc: encrypt(refreshed.access_token),
      refresh_token_enc: refreshed.refresh_token ? encrypt(refreshed.refresh_token) : conn.refresh_token_enc,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      scopes: refreshed.scope.split(" "),
    })
    .eq("id", conn.id);
  if (error) throw new Error(`Failed to persist refreshed X token: ${error.message}`);

  return refreshed.access_token;
}

export interface PostResult {
  id: string;
  text: string;
}

/** Publish a post. Text must already be within X's length limit. */
export async function createPost(accessToken: string, text: string): Promise<PostResult> {
  const res = await fetch(`${API}/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: PostResult;
    detail?: string;
    title?: string;
    errors?: { message?: string }[];
  };
  if (!res.ok || !json.data) {
    const msg = json.detail ?? json.errors?.[0]?.message ?? json.title ?? `HTTP ${res.status}`;
    throw new Error(`X post failed: ${msg}`);
  }
  return json.data;
}

/** Compose the final post text from an item: body + hashtags + link, within 280 chars. */
export function composePostText(body: string, hashtags: string[], url: string | null): string {
  const LIMIT = 280;
  const URL_LEN = 23; // X counts every URL as 23 characters
  const tags = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");

  let text = body.trim();
  const suffixParts = [tags, url ?? ""].filter(Boolean);
  const suffixLen = (tags ? tags.length + 1 : 0) + (url ? URL_LEN + 1 : 0);

  if (text.length + suffixLen > LIMIT) {
    text = text.slice(0, Math.max(0, LIMIT - suffixLen - 1)).trimEnd() + "…";
  }
  return [text, ...suffixParts].join("\n").trim();
}
