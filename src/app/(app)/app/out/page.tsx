import { createClient } from "@/lib/supabase/server";
import type { ContentItem, Post } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  posted: "bg-success/10 text-success",
  skipped: "bg-background text-muted",
  failed: "bg-danger/10 text-danger",
  approved: "bg-accent/10",
  pending: "bg-background text-muted",
};

export default async function OutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: items }, { data: posts }] = await Promise.all([
    supabase
      .from("content_items")
      .select("*")
      .eq("user_id", user!.id)
      .neq("status", "pending")
      .order("decided_at", { ascending: false })
      .limit(100)
      .returns<ContentItem[]>(),
    supabase.from("posts").select("*").eq("user_id", user!.id).order("posted_at", { ascending: false }).limit(200).returns<Post[]>(),
  ]);

  const postsByItem = new Map<string, Post[]>();
  for (const p of posts ?? []) {
    postsByItem.set(p.content_item_id, [...(postsByItem.get(p.content_item_id) ?? []), p]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Out"
        subtitle="Everything that went out, plus what you skipped."
      />

      {(items?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Swipe some cards first.</p>
      ) : (
        <ul className="space-y-2">
          {items!.map((item) => {
            const itemPosts = postsByItem.get(item.id) ?? [];
            return (
              <li key={item.id} className="card !py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.source_name} · {item.decided_at ? new Date(item.decided_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[item.status] ?? ""}`}>{item.status}</span>
                </div>
                {itemPosts.map((p) => (
                  <div key={p.id} className="mt-2 rounded-lg bg-background p-2 text-xs">
                    <span className="font-medium uppercase">{p.platform}</span>{" "}
                    {p.status === "posted" ? (
                      <a
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://x.com/i/web/status/${p.platform_post_id}`}
                      >
                        view post ↗
                      </a>
                    ) : (
                      <span className="text-danger">failed: {p.error}</span>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-muted">{p.posted_text}</p>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
