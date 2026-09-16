import Link from "next/link";
import { SwipeDeck } from "@/components/SwipeDeck";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_CONNECTION_COLUMNS, type ContentItem, type GatherRun, type Interest, type PlatformConnectionPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: items }, { data: interests }, { data: connections }, { data: lastRun }] =
    await Promise.all([
      supabase
        .from("content_items")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(40)
        .returns<ContentItem[]>(),
      supabase.from("interests").select("*").eq("user_id", user!.id).eq("active", true).returns<Interest[]>(),
      supabase
        .from("platform_connections")
        .select(PUBLIC_CONNECTION_COLUMNS)
        .eq("user_id", user!.id)
        .eq("enabled", true)
        .returns<PlatformConnectionPublic[]>(),
      supabase
        .from("gather_runs")
        .select("*")
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle<GatherRun>(),
    ]);

  const hasInterests = (interests?.length ?? 0) > 0;
  const hasConnection = (connections?.length ?? 0) > 0;

  if (!hasInterests) {
    return (
      <Empty
        title="Tell Socializer what you care about"
        body="Add a few interests and we will start gathering content for you every morning."
        cta={{ href: "/app/in/settings", label: "Add interests" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="In"
        subtitle={
          <>
            {items?.length ?? 0} candidate{(items?.length ?? 0) === 1 ? "" : "s"} waiting · swipe right to post, left to skip
            {lastRun && (
              <>
                {" "}· last gather {new Date(lastRun.started_at).toLocaleString()} ({lastRun.status}
                {lastRun.status === "done" ? `, ${lastRun.items_created} new` : ""})
              </>
            )}
          </>
        }
      />

      {!hasConnection && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
          No platform connected yet: swiping right will fail until you{" "}
          <Link href="/app/out/settings" className="underline">connect X</Link>.
        </div>
      )}

      <SwipeDeck
        initialItems={items ?? []}
        connectedPlatforms={(connections ?? []).map((c) => c.platform_username ? `@${c.platform_username}` : c.platform)}
        lastRunFailed={lastRun?.status === "failed" ? lastRun.error ?? "unknown error" : null}
      />
    </div>
  );
}

function Empty({ title, body, cta }: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="card mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link href={cta.href} className="btn-primary mt-4">{cta.label}</Link>
    </div>
  );
}
