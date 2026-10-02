"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { KNOWN_PLATFORMS, type KnownPlatform } from "@/lib/plans";
import { apiKeyHint, listIntegrations, normalizeBaseUrl, type PostizIntegration } from "@/lib/postiz";
import type { PostizSettings } from "@/lib/types";

const SETTINGS_PATH = "/app/out/settings";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function setPlatformEnabled(platform: "x", enabled: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("platform_connections")
    .update({ enabled })
    .eq("user_id", user.id)
    .eq("platform", platform);
  revalidatePath(SETTINGS_PATH);
}

const AccountInput = z.object({
  platform: z.enum(KNOWN_PLATFORMS as [KnownPlatform, ...KnownPlatform[]]),
  username: z.string().trim().max(100),
});

/** Save (or clear, when blank) the user's handle for a platform. */
export async function savePlatformAccount(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const parsed = AccountInput.safeParse({
    platform: formData.get("platform"),
    username: String(formData.get("username") ?? "").replace(/^@+/, ""),
  });
  if (!parsed.success) throw new Error("Invalid platform or username.");
  const { platform, username } = parsed.data;

  if (!username) {
    await supabase.from("platform_accounts").delete().eq("user_id", user.id).eq("platform", platform);
  } else {
    const { error } = await supabase
      .from("platform_accounts")
      .upsert({ user_id: user.id, platform, username }, { onConflict: "user_id,platform" });
    if (error) throw new Error(error.message);
  }
  revalidatePath(SETTINGS_PATH);
}

// ---------------------------------------------------------------------------
// Postiz
// ---------------------------------------------------------------------------

export interface PostizActionState {
  error?: string;
  message?: string;
}

async function syncChannels(userId: string, baseUrl: string, apiKey: string): Promise<number> {
  const integrations: PostizIntegration[] = await listIntegrations(baseUrl, apiKey);
  const admin = createAdminClient();

  // Keep the user's enabled/disabled choices for channels that still exist.
  const { data: existing } = await admin
    .from("postiz_channels")
    .select("integration_id, enabled")
    .eq("user_id", userId);
  const enabledById = new Map((existing ?? []).map((r) => [r.integration_id as string, r.enabled as boolean]));

  const rows = integrations.map((i) => ({
    user_id: userId,
    integration_id: i.id,
    identifier: i.identifier,
    name: i.name,
    profile: i.profile ?? null,
    picture: i.picture ?? null,
    disabled: Boolean(i.disabled),
    enabled: enabledById.get(i.id) ?? true,
    synced_at: new Date().toISOString(),
  }));

  // Remove channels no longer present in Postiz.
  const ids = integrations.map((i) => i.id);
  if (ids.length > 0) {
    await admin.from("postiz_channels").delete().eq("user_id", userId).not("integration_id", "in", `(${ids.map((x) => `"${x}"`).join(",")})`);
  } else {
    await admin.from("postiz_channels").delete().eq("user_id", userId);
  }
  if (rows.length > 0) {
    const { error } = await admin.from("postiz_channels").upsert(rows, { onConflict: "user_id,integration_id" });
    if (error) throw new Error(error.message);
  }
  await admin.from("postiz_settings").update({ last_synced_at: new Date().toISOString() }).eq("user_id", userId);
  return rows.length;
}

const PostizInput = z.object({
  api_key: z.string().trim().min(8).max(500),
  base_url: z.string().trim().max(300).optional(),
});

/** Connect (or replace) the user's Postiz API key, then sync channels. */
export async function connectPostiz(_prev: PostizActionState, formData: FormData): Promise<PostizActionState> {
  const { user } = await requireUser();
  const parsed = PostizInput.safeParse({
    api_key: formData.get("api_key"),
    base_url: formData.get("base_url") || undefined,
  });
  if (!parsed.success) return { error: "Enter your Postiz API key." };

  const baseUrl = normalizeBaseUrl(parsed.data.base_url);
  const apiKey = parsed.data.api_key;

  // Validate the key by listing integrations before storing anything.
  let count: number;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("postiz_settings").upsert(
      {
        user_id: user.id,
        base_url: baseUrl,
        api_key_enc: encrypt(apiKey),
        api_key_hint: apiKeyHint(apiKey),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    count = await syncChannels(user.id, baseUrl, apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Could not connect to Postiz: ${message}` };
  }

  revalidatePath(SETTINGS_PATH);
  return { message: `Postiz connected. ${count} channel${count === 1 ? "" : "s"} found.` };
}

/** Re-fetch channels from Postiz. */
export async function syncPostiz(_prev: PostizActionState): Promise<PostizActionState> {
  void _prev;
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("postiz_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<PostizSettings>();
  if (!settings) return { error: "Postiz is not connected." };
  try {
    const count = await syncChannels(user.id, settings.base_url, decrypt(settings.api_key_enc));
    revalidatePath(SETTINGS_PATH);
    return { message: `Synced ${count} channel${count === 1 ? "" : "s"} from Postiz.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function disconnectPostiz(): Promise<void> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  await admin.from("postiz_channels").delete().eq("user_id", user.id);
  await admin.from("postiz_settings").delete().eq("user_id", user.id);
  revalidatePath(SETTINGS_PATH);
}

export async function setPostizChannelEnabled(integrationId: string, enabled: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("postiz_channels")
    .update({ enabled })
    .eq("user_id", user.id)
    .eq("integration_id", integrationId);
  revalidatePath(SETTINGS_PATH);
}
