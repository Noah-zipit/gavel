"use client";

import type { VetoEvent, VerdictEvent } from "@/lib/debate-events";
import { formatWeight } from "@/lib/debate-events";
import { candidateById } from "./candidates";
import { GavelIcon } from "./icons";

interface VerdictBannerProps {
  vetoes: VetoEvent[];
  verdict: VerdictEvent | null;
}

export default function VerdictBanner({ vetoes, verdict }: VerdictBannerProps) {
  if (vetoes.length === 0 && !verdict) return null;

  const latestVeto = vetoes[vetoes.length - 1];
  const winner = verdict ? candidateById(verdict.winnerId) : undefined;
  const vetoed = latestVeto ? candidateById(latestVeto.candidateId) : undefined;
  // The API summary opens with "THE VERDICT: <name>."; the banner already
  // carries that title, so strip the duplicate lead-in.
  const summary = verdict
    ? verdict.summary.replace(/^THE VERDICT:\s*/i, "")
    : "";

  return (
    <section
      aria-label="The verdict"
      aria-live="polite"
      className="stream-in rounded-lg bg-court-gold p-5 text-[#15171c] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <GavelIcon className="h-9 w-9 shrink-0" />
          <h2 className="text-xl font-extrabold tracking-[0.12em] sm:text-2xl">
            THE VERDICT
          </h2>
        </div>

        {verdict && (
          <span className="ml-auto rounded bg-[#15171c] px-3 py-1.5 text-xs font-bold tracking-[0.18em] text-court-gold">
            DECISION · FINAL
          </span>
        )}
      </div>

      {verdict ? (
        <div className="mt-4">
          <p className="text-lg font-bold">
            {winner ? winner.name : verdict.winnerId} wins.
          </p>
          <p className="mt-1 text-[15px] font-medium">{summary}</p>
          <ol className="mt-4 flex flex-col gap-2">
            {verdict.proofChain.map((step, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline gap-x-2 rounded bg-black/15 px-3 py-2 text-sm font-medium"
              >
                <span className="font-bold">{i + 1}.</span>
                <span className="font-semibold">{step.step}</span>
                <span className="opacity-80">
                  {step.evidence} · {formatWeight(step.weight)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        latestVeto && (
          <p className="mt-4 text-lg font-bold">
            <span className="veto-strike">
              {vetoed ? vetoed.name : latestVeto.candidateId}
            </span>{" "}
            VETOED · {latestVeto.reason}
          </p>
        )
      )}
    </section>
  );
}
