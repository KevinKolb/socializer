import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GatherRun } from "@/lib/types";

/** GET /api/gather/status - the signed-in user's most recent gather run. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("gather_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<GatherRun>();

  return NextResponse.json({ run: data ?? null });
}
