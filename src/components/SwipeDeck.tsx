"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { SwipeCard, type SwipeDirection } from "@/components/SwipeCard";
import type { ContentItem } from "@/lib/types";

interface Props {
  initialItems: ContentItem[];
  connectedPlatforms: string[];
  lastRunFailed: string | null;
}

interface Toast {
  kind: "ok" | "error";
  text: string;
}

export function SwipeDeck({ initialItems, connectedPlatforms, lastRunFailed }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gathering, startGather] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const current = items[0];

  const showToast = (t: Toast) => {
    setToast(t);
    window.setTimeout(() => setToast(null), t.kind === "ok" ? 2500 : 6000);
  };

  const decide = useCallback(
    async (item: ContentItem, direction: SwipeDirection, text?: string) => {
      setBusyId(item.id);
      // Optimistically advance the deck.
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      try {
        const res = await fetch(`/api/items/${item.id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: direction === "right" ? "post" : "skip", text }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
        if (!res.ok) {
          // Put it back at the front so the user can retry.
          setItems((prev) => [item, ...prev]);
          showToast({ kind: "error", text: json.error ?? `Failed (${res.status})` });
        } else if (direction === "right") {
          showToast({ kind: "ok", text: `Posted to ${connectedPlatforms.join(", ") || "your platforms"}` });
        }
      } catch (err) {
        setItems((prev) => [item, ...prev]);
        showToast({ kind: "error", text: err instanceof Error ? err.message : "Network error" });
      } finally {
        setBusyId(null);
        setEditing(false);
      }
    },
    [connectedPlatforms],
  );

  const gatherNow = () => {
    startGather(async () => {
      const res = await fetch("/api/gather", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { created?: number; error?: string; skipped?: string };
      if (!res.ok) {
        showToast({ kind: "error", text: json.error ?? "Gather failed" });
        return;
      }
      showToast({
        kind: "ok",
        text: json.skipped ? `Nothing gathered: ${json.skipped}` : `Gathered ${json.created ?? 0} new items`,
      });
      router.refresh();
    });
  };

  return (
    <div className="relative">
      {toast && (
        <div
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg ${
            toast.kind === "ok" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card mx-auto max-w-md text-center">
          <h2 className="text-lg font-semibold">You&apos;re all caught up</h2>
          <p className="mt-2 text-sm text-muted">
            New content arrives every morning. Want more right now?
          </p>
          {lastRunFailed && (
            <p className="mt-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">
              Last gather failed: {lastRunFailed}
            </p>
          )}
          <button onClick={gatherNow} disabled={gathering} className="btn-primary mt-4">
            {gathering ? "Gathering… this takes a minute or two" : "Gather now"}
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-md">
          <div className="relative h-[520px]">
            <AnimatePresence>
              {items
                .slice(0, 3)
                .reverse()
                .map((item, idx, arr) => {
                  const isTop = idx === arr.length - 1;
                  return (
                    <SwipeCard
                      key={item.id}
                      item={item}
                      isTop={isTop}
                      depth={arr.length - 1 - idx}
                      disabled={busyId !== null || editing}
                      onSwipe={(dir) => decide(item, dir)}
                    />
                  );
                })}
            </AnimatePresence>
          </div>

          {current && (
            <div className="mt-6 space-y-3">
              {editing ? (
                <div className="card space-y-3">
                  <label className="label">Edit post text</label>
                  <textarea
                    className="input min-h-28"
                    maxLength={280}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{draft.length}/280 (hashtags + link are added automatically)</span>
                    <div className="flex gap-2">
                      <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                      <button
                        className="btn-primary"
                        disabled={!draft.trim() || busyId !== null}
                        onClick={() => decide(current, "right", draft)}
                      >
                        Post edited
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <button
                    aria-label="Skip"
                    className="btn-danger h-14 w-14 rounded-full text-xl"
                    disabled={busyId !== null}
                    onClick={() => decide(current, "left")}
                  >
                    ✕
                  </button>
                  <button
                    className="btn-secondary h-11 rounded-full px-5"
                    disabled={busyId !== null}
                    onClick={() => {
                      setDraft(current.suggested_post);
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    aria-label="Post"
                    className="btn-primary h-14 w-14 rounded-full text-xl"
                    disabled={busyId !== null}
                    onClick={() => decide(current, "right")}
                  >
                    ✓
                  </button>
                </div>
              )}
              <p className="text-center text-xs text-muted">
                Keyboard: ← skip · → post · E edit
              </p>
              <KeyboardShortcuts
                enabled={!editing && busyId === null}
                onLeft={() => decide(current, "left")}
                onRight={() => decide(current, "right")}
                onEdit={() => {
                  setDraft(current.suggested_post);
                  setEditing(true);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function KeyboardShortcuts({
  enabled,
  onLeft,
  onRight,
  onEdit,
}: {
  enabled: boolean;
  onLeft: () => void;
  onRight: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") onLeft();
      else if (e.key === "ArrowRight") onRight();
      else if (e.key.toLowerCase() === "e") onEdit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onLeft, onRight, onEdit]);
  return null;
}
