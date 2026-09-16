import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/x/oauth";
import { fetchMe } from "@/lib/x/api";

function settingsRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/app/out/settings", request.url);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: "x_pkce_verifier", path: "/api/x/callback" });
  res.cookies.delete({ name: "x_oauth_state", path: "/api/x/callback" });
  return res;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const verifier = request.cookies.get("x_pkce_verifier")?.value;
  const expectedState = request.cookies.get("x_oauth_state")?.value;

  if (oauthError) return settingsRedirect(request, { x: "denied" });
  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return settingsRedirect(request, { x: "invalid_state" });
  }

  try {
    const token = await exchangeCode(code, verifier);
    const me = await fetchMe(token.access_token);

    const admin = createAdminClient();
    const { error } = await admin.from("platform_connections").upsert(
      {
        user_id: user.id,
        platform: "x",
        enabled: true,
        platform_user_id: me.id,
        platform_username: me.username,
        access_token_enc: encrypt(token.access_token),
        refresh_token_enc: token.refresh_token ? encrypt(token.refresh_token) : null,
        token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
        scopes: token.scope.split(" "),
      },
      { onConflict: "user_id,platform" },
    );
    if (error) throw new Error(error.message);

    return settingsRedirect(request, { x: "connected" });
  } catch (err) {
    console.error("X callback failed", err);
    return settingsRedirect(request, { x: "failed" });
  }
}
