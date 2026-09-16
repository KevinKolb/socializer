import Link from "next/link";
import type { PlatformAccount, PlatformConnectionPublic } from "@/lib/types";
import { KNOWN_PLATFORMS, PLATFORM_META } from "@/lib/plans";
import { savePlatformAccount, setPlatformEnabled } from "./actions";
import { DisconnectButton } from "./DisconnectButton";

const NOTICES: Record<string, { kind: "ok" | "error"; text: string }> = {
  connected: { kind: "ok", text: "X connected. Swiping right will now post to your account." },
  denied: { kind: "error", text: "You cancelled the X authorization." },
  invalid_state: { kind: "error", text: "The X sign-in expired or was tampered with. Try again." },
  failed: { kind: "error", text: "Connecting X failed. Check your X app credentials and callback URL." },
  not_configured: {
    kind: "error",
    text: "X posting is not configured on this deployment yet: X_CLIENT_ID and X_CLIENT_SECRET are missing. See the README for creating the X developer app.",
  },
};

export function PlatformsSection({
  connections,
  accounts,
  notice,
  planName,
}: {
  connections: PlatformConnectionPublic[];
  accounts: PlatformAccount[];
  notice: string | null;
  planName: string;
}) {
  const x = connections.find((c) => c.platform === "x") ?? null;
  const n = notice ? NOTICES[notice] : null;
  const usernameFor = (platform: string) =>
    accounts.find((a) => a.platform === platform)?.username ??
    (platform === "x" ? x?.platform_username ?? "" : "");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Platforms</h2>
        <p className="text-sm text-muted">
          Record your account on each platform. Swiping right posts to every platform that is
          connected and enabled. X is included on the Free plan
          {planName === "Free" && (
            <>; the rest need <Link href="/app/billing" className="underline">Pro</Link></>
          )}
          .
        </p>
      </div>

      {n && (
        <p className={`rounded-lg p-3 text-sm ${n.kind === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {n.text}
        </p>
      )}

      <ul className="space-y-2">
        {KNOWN_PLATFORMS.map((key) => {
          const meta = PLATFORM_META[key];
          const isX = key === "x";
          return (
            <li key={key} className="card !py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isX ? "bg-foreground text-background" : "border border-border"
                  }`}
                >
                  {meta.mark}
                </div>

                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium">{meta.label}</p>
                  <p className="text-xs text-muted">
                    {isX
                      ? x
                        ? `Connected as @${x.platform_username} · ${x.enabled ? "posting enabled" : "posting paused"}`
                        : "Posting live · not connected"
                      : `Posting coming soon${meta.note ? ` · ${meta.note}` : ""}`}
                  </p>
                </div>

                <form action={savePlatformAccount} className="flex items-center gap-2">
                  <input type="hidden" name="platform" value={key} />
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
                    <input
                      name="username"
                      className="input w-44 !pl-7"
                      placeholder="username"
                      defaultValue={usernameFor(key)}
                      maxLength={100}
                      aria-label={`${meta.label} username`}
                    />
                  </div>
                  <button className="btn-secondary !py-1.5 text-xs">Save</button>
                </form>

                {isX && (
                  x ? (
                    <div className="flex gap-2">
                      <form action={setPlatformEnabled.bind(null, "x", !x.enabled)}>
                        <button className="btn-secondary !py-1.5 text-xs">{x.enabled ? "Pause" : "Resume"}</button>
                      </form>
                      <DisconnectButton />
                    </div>
                  ) : (
                    <a href="/api/x/connect" className="btn-primary !py-1.5 text-xs">Connect X</a>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
