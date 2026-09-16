import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { buildAuthorizeUrl, createPkce } from "@/lib/x/oauth";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { verifier, challenge, state } = createPkce();
  const res = NextResponse.redirect(buildAuthorizeUrl(challenge, state));

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/x/callback",
    maxAge: 600,
  };
  res.cookies.set("x_pkce_verifier", verifier, cookieOpts);
  res.cookies.set("x_oauth_state", state, cookieOpts);
  return res;
}
