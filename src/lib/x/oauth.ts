import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * X (Twitter) OAuth 2.0 Authorization Code flow with PKCE.
 * Docs: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
 */

export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"] as const;

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REVOKE_URL = "https://api.x.com/2/oauth2/revoke";

export function redirectUri(): string {
  return `${env.appUrl()}/api/x/callback`;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createPkce() {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(24));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.xClientId(),
    redirect_uri: redirectUri(),
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface XTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope: string;
  refresh_token?: string;
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${env.xClientId()}:${env.xClientSecret()}`).toString("base64");
}

async function tokenRequest(body: URLSearchParams): Promise<XTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Partial<XTokenResponse> & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `X token request failed (${res.status}): ${json.error_description ?? json.error ?? "unknown error"}`,
    );
  }
  return json as XTokenResponse;
}

export function exchangeCode(code: string, verifier: string): Promise<XTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      client_id: env.xClientId(),
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<XTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.xClientId(),
    }),
  );
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({ token, client_id: env.xClientId() }),
  }).catch(() => undefined);
}
