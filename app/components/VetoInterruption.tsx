"use client";

import type { VetoEvent } from "@/lib/debate-events";

/**
 * Full-width veto interruption: when a veto fires mid-debate, the transcript
 * flow pauses and this objection card takes the stage. Restrained
 * fade/slide-in (honors prefers-reduced-motion via the global rule).
 */
export default function VetoInterruption({ veto }: { veto: VetoEvent }) {
  const name = veto.candidateName ?? veto.candidateId;
  return (
    <section
      aria-label="Veto"
      aria-live="assertive"
      className="stream-in rounded-lg border border-court-live/60 bg-court-panel p-5 sm:p-6"
    >
      <p className="eyebrow text-court-live">Veto · Objection sustained</p>
      <p className="mt-2 text-xl font-extrabold text-court-text sm:text-2xl">
        {veto.by} vetoes{" "}
        <span className="veto-strike text-court-live">{name}</span>
      </p>
      <p className="mt-2 max-w-2xl text-[15px] font-medium text-court-muted">
        {veto.reason}
      </p>
    </section>
  );
}
