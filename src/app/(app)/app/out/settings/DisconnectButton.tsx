"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DisconnectButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger !py-1 text-xs"
      disabled={pending}
      onClick={() => {
        if (!confirm("Disconnect X? Socializer will no longer be able to post for you.")) return;
        start(async () => {
          await fetch("/api/x/disconnect", { method: "POST" });
          router.refresh();
        });
      }}
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
