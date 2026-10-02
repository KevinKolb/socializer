"use client";

import { useActionState } from "react";
import { connectPostiz, syncPostiz, type PostizActionState } from "./actions";

const initial: PostizActionState = {};

export function PostizConnectForm() {
  const [state, action, pending] = useActionState(connectPostiz, initial);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="postiz_api_key">Postiz API key</label>
        <input
          id="postiz_api_key"
          name="api_key"
          type="password"
          className="input"
          autoComplete="off"
          placeholder="paste the key from Postiz → Settings → Public API"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="postiz_base_url">Postiz API URL (self-hosted only)</label>
        <input
          id="postiz_base_url"
          name="base_url"
          className="input"
          placeholder="https://api.postiz.com"
        />
        <p className="mt-1 text-xs text-muted">Leave blank for Postiz cloud. For self-hosted, enter your backend URL.</p>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && <p className="text-sm text-success">{state.message}</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Connecting…" : "Connect Postiz"}
      </button>
    </form>
  );
}

export function PostizSyncButton() {
  const [state, action, pending] = useActionState(syncPostiz, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <button className="btn-secondary !py-1.5 text-xs" disabled={pending}>
        {pending ? "Syncing…" : "Sync channels"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
      {state.message && <span className="text-xs text-success">{state.message}</span>}
    </form>
  );
}
