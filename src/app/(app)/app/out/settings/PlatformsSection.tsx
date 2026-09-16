import Link from "next/link";
import type { PlatformConnectionPublic } from "@/lib/types";
import { KNOWN_PLATFORMS, PLATFORM_META } from "@/lib/plans";
import { setPlatformEnabled } from "./actions";
import { DisconnectButton } from "./DisconnectButton";

const NOTICES: Record<string, { kind: "ok" | "error"; text: string }> = {
  connected: { kind: "ok", text: "X connected. Swiping right will now post to your account." },
  denied: { kind: "error", text: "You cancelled the X authorization." },
  invalid_state: { kind: "error", text: "The X sign-in expired or was tampered with. Try again." },
  failed: { kind: "error", text: "Connecting X failed. Check your X app credentials and callback URL." },
};

export function PlatformsSection({
  connections,
  notice,
  planName,
}: {
  connections: PlatformConnectionPublic[];
  notice: string | null;
  planName: string;
}) {
  const x = connections.find((c) => c.platform === "x") ?? null;
  const n = notice ? NOTICES[notice] : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Platforms</h2>
        <p className="text-sm text-muted">
          Swiping right posts to every enabled platform below. X is included on the Free plan.
          {planName === "Free" && (
            <> Other platforms need <Link href="/app/billing" className="underline">Pro</Link>.</>
          )}
        </p>
      </div>

      {n && (
        <p className={`rounded-lg p-3 text-sm ${n.kind === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {n.text}
        </p>
      )}

      <div className="card flex flex-wrap items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-lg font-bold text-background">
          X
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">X (Twitter)</p>
          {x ? (
            <p className="text-sm text-muted">
              Connected as @{x.platform_username} · {x.enabled ? "posting enabled" : "posting paused"}
            </p>
          ) : (
            <p className="text-sm text-muted">Not connected</p>
          )}
        </div>
        {x ? (
          <div className="flex gap-2">
            <form action={setPlatformEnabled.bind(null, "x", !x.enabled)}>
              <button className="btn-secondary !py-1 text-xs">{x.enabled ? "Pause posting" : "Resume posting"}</button>
            </form>
            <DisconnectButton />
          </div>
        ) : (
          <a href="/api/x/connect" className="btn-primary">Connect X</a>
        )}
      </div>

      <div>
        <p className="label">Coming soon</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {KNOWN_PLATFORMS.filter((k) => k !== "x").map((key) => {
            const meta = PLATFORM_META[key];
            return (
              <li key={key} className="card flex items-center gap-3 !py-3 opacity-70">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-xs font-bold">
                  {meta.mark}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{meta.label}</p>
                  <p className="truncate text-xs text-muted">{meta.note ?? "text posts"} · Pro</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Want one of these first? Tell us which and we will prioritise it.
        </p>
      </div>
    </section>
  );
}
