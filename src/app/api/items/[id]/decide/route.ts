import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canPostTo, getEntitlement } from "@/lib/entitlements";
import { decrypt } from "@/lib/crypto";
import { composePostText, createPost, getValidAccessToken } from "@/lib/x/api";
import { PROVIDER_CHAR_LIMITS, TEXT_CAPABLE_PROVIDERS, publishNow } from "@/lib/postiz";
import type {
  ContentItem,
  PlatformConnection,
  PostizChannel,
  PostizSettings,
  Profile,
  Subscription,
} from "@/lib/types";

const Body = z.object({
  decision: z.enum(["skip", "post"]),
  /** Optional user-edited post text (body only; hashtags + link are appended). */
  text: z.string().max(5000).optional(),
});

interface Target {
  platform: string;
  label: string;
  publish: (text: string) => Promise<string>; // returns platform post id
  limit: number;
}

/**
 * POST /api/items/:id/decide  { decision: "skip" | "post", text? }
 * Swipe left  -> skip
 * Swipe right -> publish now to every enabled channel:
 *   1. via Postiz, when the user connected a Postiz account (any platform), else
 *   2. directly to X, when the user connected X with OAuth.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/decide">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { decision, text } = parsed.data;

  const { data: item } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<ContentItem>();
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "pending" && item.status !== "failed") {
    return NextResponse.json({ error: `Item already ${item.status}` }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (decision === "skip") {
    await supabase.from("content_items").update({ status: "skipped", decided_at: now }).eq("id", id);
    return NextResponse.json({ ok: true, status: "skipped" });
  }

  // ---- post ----
  const admin = createAdminClient(); // needed to read encrypted tokens / keys
  const [{ data: profile }, { data: sub }, { data: postiz }, { data: channels }, { data: connections }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle<Subscription>(),
      admin.from("postiz_settings").select("*").eq("user_id", user.id).maybeSingle<PostizSettings>(),
      admin.from("postiz_channels").select("*").eq("user_id", user.id).eq("enabled", true).returns<PostizChannel[]>(),
      admin
        .from("platform_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .returns<PlatformConnection[]>(),
    ]);
  if (!profile) return NextResponse.json({ error: "Profile missing" }, { status: 400 });
  const entitlement = getEntitlement(profile, sub ?? null);

  const targets: Target[] = [];
  const blockedByPlan: string[] = [];

  if (postiz && channels && channels.length > 0) {
    const apiKey = decrypt(postiz.api_key_enc);
    for (const ch of channels) {
      if (ch.disabled || !TEXT_CAPABLE_PROVIDERS.has(ch.identifier)) continue;
      if (!canPostTo(entitlement, ch.identifier)) {
        blockedByPlan.push(ch.identifier);
        continue;
      }
      targets.push({
        platform: ch.identifier,
        label: `${ch.name}${ch.profile ? ` (@${ch.profile})` : ""}`,
        limit: PROVIDER_CHAR_LIMITS[ch.identifier] ?? 3000,
        publish: async (content) => {
          const r = await publishNow(postiz.base_url, apiKey, {
            integrationId: ch.integration_id,
            identifier: ch.identifier,
            content,
            sourceUrl: item.source_url,
          });
          return `postiz:${r.postId}`;
        },
      });
    }
  } else {
    for (const conn of connections ?? []) {
      if (conn.platform !== "x") continue;
      if (!canPostTo(entitlement, "x")) {
        blockedByPlan.push("x");
        continue;
      }
      targets.push({
        platform: "x",
        label: conn.platform_username ? `@${conn.platform_username}` : "X",
        limit: 280,
        publish: async (content) => {
          const accessToken = await getValidAccessToken(conn);
          const posted = await createPost(accessToken, content);
          return posted.id;
        },
      });
    }
  }

  if (targets.length === 0) {
    if (blockedByPlan.length > 0) {
      return NextResponse.json(
        { error: `Your ${entitlement.plan.name} plan cannot post to ${blockedByPlan.join(", ")}. Upgrade under Billing.` },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: "No channel to post to. Connect Postiz or X under Out → settings first." },
      { status: 400 },
    );
  }

  const body = (text ?? item.suggested_post).trim();
  if (!body) return NextResponse.json({ error: "Post text is empty" }, { status: 400 });

  const results: { platform: string; label: string; ok: boolean; id?: string; error?: string }[] = [];

  for (const t of targets) {
    const finalText = composePostText(body, item.hashtags, item.source_url, t.limit);
    try {
      const platformPostId = await t.publish(finalText);
      await admin.from("posts").insert({
        user_id: user.id,
        content_item_id: item.id,
        platform: t.platform,
        platform_post_id: platformPostId,
        posted_text: finalText,
        status: "posted",
      });
      results.push({ platform: t.platform, label: t.label, ok: true, id: platformPostId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin.from("posts").insert({
        user_id: user.id,
        content_item_id: item.id,
        platform: t.platform,
        posted_text: finalText,
        status: "failed",
        error: message,
      });
      results.push({ platform: t.platform, label: t.label, ok: false, error: message });
    }
  }

  const anyOk = results.some((r) => r.ok);
  const status = anyOk ? "posted" : "failed";
  await supabase.from("content_items").update({ status, decided_at: now }).eq("id", id);

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    {
      ok: anyOk,
      status,
      results,
      error: anyOk ? undefined : failed.map((f) => `${f.label}: ${f.error}`).join("; "),
    },
    { status: anyOk ? 200 : 502 },
  );
}
