import { PROVIDER_CHAR_LIMITS, TEXT_CAPABLE_PROVIDERS, providerLabel } from "@/lib/postiz";
import type { PostizChannel, PostizSettingsPublic } from "@/lib/types";
import { PostizConnectForm, PostizSyncButton } from "./PostizForms";
import { disconnectPostiz, setPostizChannelEnabled } from "./actions";

export function PostizSection({
  settings,
  channels,
  planName,
  planAllPlatforms,
}: {
  settings: PostizSettingsPublic | null;
  channels: PostizChannel[];
  planName: string;
  planAllPlatforms: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Postiz</h2>
        <p className="text-sm text-muted">
          Connect your Postiz account and Socializer posts through it to every channel you enable
          below. Postiz handles the logins to each network. Get the key in Postiz under
          Settings → Public API.
        </p>
      </div>

      {settings ? (
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Connected</p>
              <p className="text-xs text-muted">
                Key ending ••••{settings.api_key_hint} · {settings.base_url}
                {settings.last_synced_at && <> · synced {new Date(settings.last_synced_at).toLocaleString()}</>}
              </p>
            </div>
            <PostizSyncButton />
            <form action={disconnectPostiz}>
              <button className="btn-danger !py-1.5 text-xs">Disconnect</button>
            </form>
          </div>

          {channels.length === 0 ? (
            <p className="text-sm text-muted">
              No channels yet. Add channels in Postiz, then click Sync.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {channels.map((ch) => {
                const textOk = TEXT_CAPABLE_PROVIDERS.has(ch.identifier);
                const planOk = planAllPlatforms || ch.identifier === "x";
                const usable = textOk && planOk && !ch.disabled;
                return (
                  <li key={ch.integration_id} className="flex flex-wrap items-center gap-3 py-2">
                    {ch.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ch.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-bold">
                        {providerLabel(ch.identifier)[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {ch.name}
                        {ch.profile && <span className="text-muted"> @{ch.profile}</span>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {providerLabel(ch.identifier)}
                        {ch.disabled && " · disabled in Postiz"}
                        {!textOk && " · needs media, not supported yet"}
                        {textOk && !planOk && ` · needs Pro (you are on ${planName})`}
                        {usable && ` · up to ${PROVIDER_CHAR_LIMITS[ch.identifier] ?? 3000} chars`}
                      </p>
                    </div>
                    <form action={setPostizChannelEnabled.bind(null, ch.integration_id, !ch.enabled)}>
                      <button className="btn-secondary !py-1.5 text-xs" disabled={!usable && !ch.enabled}>
                        {ch.enabled ? "Posting on" : "Posting off"}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="card">
          <PostizConnectForm />
        </div>
      )}
    </section>
  );
}
