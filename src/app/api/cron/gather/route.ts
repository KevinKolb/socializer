import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherForUser } from "@/lib/gather";

export const maxDuration = 300;

/**
 * GET /api/cron/gather
 * Invoked daily by Vercel Cron (see vercel.json) with
 * "Authorization: Bearer $CRON_SECRET". Gathers fresh items for every user
 * that has at least one active interest.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorized =
    auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: users, error } = await admin
    .from("interests")
    .select("user_id")
    .eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((users ?? []).map((u) => u.user_id as string))];

  // Small concurrency so one slow user does not block the batch.
  const CONCURRENCY = 3;
  const outcomes: Awaited<ReturnType<typeof gatherForUser>>[] = [];
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const chunk = userIds.slice(i, i + CONCURRENCY);
    outcomes.push(...(await Promise.all(chunk.map((id) => gatherForUser(admin, id, "cron")))));
  }

  return NextResponse.json({
    users: userIds.length,
    created: outcomes.reduce((n, o) => n + o.created, 0),
    outcomes,
  });
}
