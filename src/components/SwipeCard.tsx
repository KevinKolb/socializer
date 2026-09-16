"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { ContentItem } from "@/lib/types";

export type SwipeDirection = "left" | "right";

interface Props {
  item: ContentItem;
  isTop: boolean;
  depth: number; // 0 = top card
  disabled: boolean;
  onSwipe: (direction: SwipeDirection) => void;
}

const THRESHOLD = 120;

export function SwipeCard({ item, isTop, depth, disabled, onSwipe }: Props) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const postOpacity = useTransform(x, [40, THRESHOLD], [0, 1]);
  const skipOpacity = useTransform(x, [-THRESHOLD, -40], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset > THRESHOLD || velocity > 800) onSwipe("right");
    else if (offset < -THRESHOLD || velocity < -800) onSwipe("left");
  };

  return (
    <motion.div
      className="card absolute inset-0 flex cursor-grab flex-col overflow-hidden active:cursor-grabbing"
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={{ scale: 1 - depth * 0.04, y: depth * 12, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.04, y: depth * 12, opacity: 1 }}
      exit={{
        x: (x.get() >= 0 ? 1 : -1) * 600,
        opacity: 0,
        transition: { duration: 0.25 },
      }}
      drag={isTop && !disabled ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
    >
      {isTop && (
        <>
          <motion.div
            style={{ opacity: postOpacity }}
            className="pointer-events-none absolute left-4 top-4 rotate-[-12deg] rounded-md border-2 border-success px-3 py-1 text-lg font-bold text-success"
          >
            POST
          </motion.div>
          <motion.div
            style={{ opacity: skipOpacity }}
            className="pointer-events-none absolute right-4 top-4 rotate-[12deg] rounded-md border-2 border-danger px-3 py-1 text-lg font-bold text-danger"
          >
            SKIP
          </motion.div>
        </>
      )}

      <div className="flex items-center justify-between text-xs text-muted">
        <span className="truncate">{item.source_name ?? "Source"}</span>
        <span>{new Date(item.created_at).toLocaleDateString()}</span>
      </div>

      <h3 className="mt-2 text-lg font-semibold leading-snug">{item.title}</h3>
      <p className="mt-2 line-clamp-4 text-sm text-muted">{item.summary}</p>

      {item.why_relevant && (
        <p className="mt-2 text-xs italic text-muted">Why: {item.why_relevant}</p>
      )}

      <div className="mt-auto space-y-2 pt-4">
        <p className="label">Suggested post</p>
        <div className="rounded-xl bg-background p-3 text-sm whitespace-pre-wrap">{item.suggested_post}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {item.hashtags.map((h) => (
            <span key={h} className="rounded-full border border-border px-2 py-0.5">#{h}</span>
          ))}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              Open source ↗
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
