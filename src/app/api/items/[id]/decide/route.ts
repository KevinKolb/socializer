import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canPostTo, getEntitlement } from "@/lib/entitlements";
import { composePostText, createPost, getValidAccessToken } from "@/lib/x/api";
import type { ContentItem, PlatformConnection, Profile, Subscription } from "@/lib/types";

const Body = z.object({
  decision: z.enum(["skip", "post"]),
  /** Optional user-edited post text (body only; hashtags + link are appended). */
  text: z.string().max(280).optional(),
});

/**
 * POST /api/items/:id/decide  { decision: "skip" | "post", text? }
 * Swipe left  -> skip
 * Swipe right -> publish to every enabled, connected platform now.
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
  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle<Subscription>(),
  ]);
  if (!profile) return NextResponse.json({ error: "Profile missing" }, { status: 400 });
  const entitlement = getEntitlement(profile, sub ?? null);

  const admin = createAdminClient(); // needed to read encrypted tokens
  const { data: connections } = await admin
    .from("platform_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("enabled", true)
    .returns<PlatformConnection[]>();

  if (!connections || connections.length === 0) {
    return NextResponse.json(
      { error: "No platform connected. Connect X under Out → settings first." },
      { status: 400 },
    );
  }

  const allowed = connections.filter((c) => canPostTo(entitlement, c.platform));
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: `Your ${entitlement.plan.name} plan cannot post to the connected platforms. Upgrade under Billing.` },
      { status: 402 },
    );
  }

  const body = (text ?? item.suggested_post).trim();
  if (!body) return NextResponse.json({ error: "Post text is empty" }, { status: 400 });

  const results: { platform: string; ok: boolean; id?: string; error?: string }[] = [];

  for (const conn of allowed) {
    if (conn.platform !== "x") continue;
    const finalText = composePostText(body, item.hashtags, item.source_url);
    try {
      const accessToken = await getValidAccessToken(conn);
      const posted = await createPost(accessToken, finalText);
      await admin.from("posts").insert({
        user_id: user.id,
        content_item_id: item.id,
        platform: "x",
        platform_post_id: posted.id,
        posted_text: finalText,
        status: "posted",
      });
      results.push({ platform: "x", ok: true, id: posted.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin.from("posts").insert({
        user_id: user.id,
        content_item_id: item.id,
        platform: "x",
        posted_text: finalText,
        status: "failed",
        error: message,
      });
      results.push({ platform: "x", ok: false, error: message });
    }
  }

  const anyOk = results.some((r) => r.ok);
  const status = anyOk ? "posted" : "failed";
  await supabase.from("content_items").update({ status, decided_at: now }).eq("id", id);

  return NextResponse.json(
    { ok: anyOk, status, results },
    { status: anyOk ? 200 : 502 },
  );
}
