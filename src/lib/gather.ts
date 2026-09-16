import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverContent } from "@/lib/ai/discover";
import { dailyCardLimit, getEntitlement } from "@/lib/entitlements";
import type { Interest, Profile, Subscription } from "@/lib/types";

export interface GatherOutcome {
  userId: string;
  created: number;
  skipped?: string;
  error?: string;
}

/**
 * Runs one discovery job for a single user and stores the results as pending
 * content items. `db` must be a service-role client: gather_runs is not
 * writable by end users, so callers verify the user themselves first.
 */
export async function gatherForUser(
  db: SupabaseClient,
  userId: string,
  trigger: "cron" | "manual",
): Promise<GatherOutcome> {
  const [{ data: profile }, { data: sub }, { data: interests }] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single<Profile>(),
    db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle<Subscription>(),
    db.from("interests").select("*").eq("user_id", userId).eq("active", true).returns<Interest[]>(),
  ]);

  if (!profile) return { userId, created: 0, skipped: "no profile" };
  const entitlement = getEntitlement(profile, sub ?? null);
  if (!interests || interests.length === 0) {
    return { userId, created: 0, skipped: "no active interests" };
  }

  // Do not pile up cards: only top up to the daily target.
  const { count: pendingCount } = await db
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  const needed = Math.max(0, dailyCardLimit(entitlement, profile) - (pendingCount ?? 0));
  if (needed < 3) return { userId, created: 0, skipped: "queue already full" };

  const { data: run } = await db
    .from("gather_runs")
    .insert({ user_id: userId, trigger })
    .select("id")
    .single<{ id: string }>();

  try {
    const { data: recent } = await db
      .from("content_items")
      .select("title, source_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);

    const candidates = await discoverContent({
      interests: interests.map((i) => ({
        id: i.id,
        topic: i.topic,
        guidance: i.guidance,
        sources: i.sources,
      })),
      voice: profile.voice,
      target: needed,
      recentlySeen: (recent ?? []).map((r) => ({ title: r.title, url: r.source_url })),
      platforms: ["x"],
    });

    // Skip URLs we already have for this user.
    const existingUrls = new Set((recent ?? []).map((r) => r.source_url).filter(Boolean));
    const rows = candidates
      .filter((c) => !existingUrls.has(c.source_url))
      .map((c) => ({
        user_id: userId,
        interest_id: c.interest_id,
        title: c.title,
        summary: c.summary,
        source_url: c.source_url,
        source_name: c.source_name,
        why_relevant: c.why_relevant,
        suggested_post: c.suggested_post,
        hashtags: c.hashtags,
      }));

    let created = 0;
    if (rows.length > 0) {
      const { error, count } = await db.from("content_items").insert(rows, { count: "exact" });
      if (error) throw new Error(error.message);
      created = count ?? rows.length;
    }

    if (run) {
      await db
        .from("gather_runs")
        .update({ status: "done", items_created: created, finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
    return { userId, created };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (run) {
      await db
        .from("gather_runs")
        .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
    return { userId, created: 0, error: message };
  }
}
