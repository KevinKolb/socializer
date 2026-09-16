import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherForUser } from "@/lib/gather";

export const maxDuration = 300; // discovery can take a few minutes

/** POST /api/gather - run discovery for the signed-in user right now. */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // One run at a time per user.
  const { data: running } = await admin
    .from("gather_runs")
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1);
  if (running && running.length > 0) {
    return NextResponse.json({ error: "A gather is already running" }, { status: 409 });
  }

  const outcome = await gatherForUser(admin, user.id, "manual");
  if (outcome.error) return NextResponse.json(outcome, { status: 500 });
  return NextResponse.json(outcome);
}
