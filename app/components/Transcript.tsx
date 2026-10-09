"use client";

import { useEffect, useRef } from "react";
import {
  roundLabel,
  weightToPct,
  type ArgumentEvent,
} from "@/lib/debate-events";
import { EvidenceIcon } from "./icons";

interface TranscriptProps {
  items: ArgumentEvent[];
  streaming: boolean;
}

function Bubble({ item, index }: { item: ArgumentEvent; index: number }) {
  const isA = item.side === "a";
  const bubble = isA
    ? "bg-court-amber text-[#15171c]"
    : "bg-court-teal text-[#15171c]";
  const chip = "bg-black/20";
  // The evidence label often already carries its own percentage
  // ("Alex's taste graph: 92% Italian alignment"); only append the
  // weight when the label does not state one.
  const labelHasPct = /\d+\s*%/.test(item.evidence.label);
  const chipText = labelHasPct
    ? item.evidence.label
    : `${item.evidence.label} · ${weightToPct(item.evidence.weight)}%`;

  return (
    <li
      className={`stream-in flex ${isA ? "justify-start" : "justify-end"}`}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className={`max-w-[92%] rounded-md p-4 sm:max-w-[80%] ${bubble}`}>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold tracking-wide">
          <span>{isA ? "Advocate A" : "Advocate B"}</span>
          <span className="font-medium opacity-70">{roundLabel(item.round)}</span>
        </p>
        <p className="mt-1.5 text-[15px] font-medium leading-relaxed">
          {item.text}
        </p>
        <p
          className={`mt-3 flex items-center gap-2 rounded px-2.5 py-1.5 text-sm font-semibold ${chip}`}
          title={item.evidence.detail ?? undefined}
        >
          <EvidenceIcon className="h-4 w-4 shrink-0" />
          <span>{chipText}</span>
        </p>
      </div>
    </li>
  );
}

export default function Transcript({ items, streaming }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [items.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  return (
    <section
      aria-label="Live debate transcript"
      className="flex min-h-0 flex-col rounded-lg border border-court-border bg-court-panel p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-[0.18em] text-court-muted">
          LIVE DEBATE TRANSCRIPT
        </h2>
        <p className="text-xs font-semibold tracking-widest text-court-muted">
          <span className="text-court-teal" aria-hidden="true">
            ●
          </span>{" "}
          {streaming ? "2 AGENTS · ACTIVE" : `${items.length} ARGUMENTS`}
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-atomic="false"
        className="min-h-[220px] max-h-[420px] flex-1 overflow-y-auto pr-1"
      >
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-court-muted">
            {streaming
              ? "The advocates are taking the floor…"
              : "No arguments yet. The transcript will stream here."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, i) => (
              <Bubble key={`${item.round}-${item.side}-${i}`} item={item} index={i} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
