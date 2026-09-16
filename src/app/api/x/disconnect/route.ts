import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { revokeToken } from "@/lib/x/oauth";
import type { PlatformConnection } from "@/lib/types";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("platform_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", "x")
    .maybeSingle<PlatformConnection>();

  if (conn) {
    try {
      await revokeToken(decrypt(conn.access_token_enc));
    } catch {
      // Best effort; we delete our copy regardless.
    }
    await admin.from("platform_connections").delete().eq("id", conn.id);
  }

  return NextResponse.json({ ok: true });
}
