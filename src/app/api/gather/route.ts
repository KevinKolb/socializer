import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherForUser } from "@/lib/gather";

export const maxDuration = 300;

/**
 * POST /api/gather - "Gather now" for the signed-in user.
 *
 * Two modes:
 *  - Dispatch (recommended on hosts with short function timeouts such as Netlify):
 *    when GITHUB_REPOSITORY and GITHUB_DISPATCH_TOKEN are set, triggers the
 *    "Gather content" GitHub Actions workflow for this user and returns { queued: true }.
 *  - Inline: otherwise runs discovery in this request.
 */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // One run at a time per user.
  const { data: running } = await admin
    .from("gather_runs")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1);
  if (running && running.length > 0) {
    return NextResponse.json({ error: "A gather is already running" }, { status: 409 });
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (repo && token) {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/gather.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_DISPATCH_REF ?? "main",
        inputs: { user_id: user.id },
      }),
    });
    if (res.status !== 204) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Could not start gather (${res.status}): ${text.slice(0, 200)}` }, { status: 502 });
    }
    return NextResponse.json({ queued: true });
  }

  const outcome = await gatherForUser(admin, user.id, "manual");
  if (outcome.error) return NextResponse.json(outcome, { status: 500 });
  return NextResponse.json(outcome);
}
