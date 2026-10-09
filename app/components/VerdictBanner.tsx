"use client";

import { useState } from "react";
import type { ScoreEvent, VetoEvent, VerdictEvent } from "@/lib/debate-events";
import { weightToPct } from "@/lib/debate-events";
import { GavelIcon } from "./icons";
import VerdictCardShare from "./verdict-card/VerdictCardShare";
import type { VerdictCardData } from "./verdict-card/drawVerdictCard";

interface VerdictBannerProps {
  vetoes: VetoEvent[];
  verdict: VerdictEvent | null;
  score: ScoreEvent | null;
  /** [Advocate A candidate, Advocate B candidate] for the card's split bar */
  candidateNames: [string, string];
}

/** "is 0.18, below" -> 18. Defensive: veto reasons vary by adapter. */
function vetoAffinityPct(reason: string): number | null {
  const m = reason.match(/is\s+(\d?\.\d+)/);
  if (m) {
    const v = parseFloat(m[1]!);
    if (Number.isFinite(v)) return Math.round(v <= 1 ? v * 100 : v);
  }
  const p = reason.match(/(\d+)\s*%/);
  if (p) return parseInt(p[1]!, 10);
  return null;
}

function buildShareText(
  winnerName: string,
  vetoes: VetoEvent[],
  proofSteps: Array<{ step: string }>,
  url: string
): string {
  const parts = [`THE VERDICT: ${winnerName} wins.`];
  const veto = vetoes[vetoes.length - 1];
  if (veto) {
    const pct = vetoAffinityPct(veto.reason);
    const name = veto.candidateName ?? veto.candidateId;
    parts.push(
      pct !== null
        ? `${veto.by} vetoed ${name} (${pct}% affinity, below the group's line).`
        : `${veto.by} vetoed ${name}.`
    );
  }
  const top = proofSteps
    .filter((s) => /%/.test(s.step))
    .slice(0, 2)
    .map((s) => s.step.trim());
  if (top.length > 0) {
    parts.push(`Strongest evidence: ${top.join("; ")}.`);
  } else {
    parts.push(`Decided by ${proofSteps.length} evidence points.`);
  }
  parts.push(`Settled by the AI Courtroom: ${url}`);
  return parts.join(" ");
}

export default function VerdictBanner({
  vetoes,
  verdict,
  score,
  candidateNames,
}: VerdictBannerProps) {
  if (vetoes.length === 0 && !verdict) return null;

  const [cardOpen, setCardOpen] = useState(false);
  const latestVeto = vetoes[vetoes.length - 1];
  const winnerName = verdict?.winnerName ?? verdict?.winnerId ?? "";
  const vetoedName = latestVeto?.candidateName ?? latestVeto?.candidateId ?? "";
  // The API summary opens with "THE VERDICT: <name>." and then repeats the
  // winner's name; the banner already carries the title and headline, so
  // strip both duplicate lead-ins.
  const summary = verdict
    ? verdict.summary
        .replace(/^THE VERDICT:\s*/i, "")
        .replace(new RegExp(`^${winnerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\s*`, "i"), "")
    : "";
  // Proof chain cleanup: drop the trailing "Verdict: X wins" step (the
  // headline already says it), and for affinity steps the evidence text
  // duplicates the step ("92% affinity" vs "92% Italian alignment"), so show
  // the step alone. Veto steps keep their reason, it carries new information.
  const proofSteps = (verdict?.proofChain ?? []).filter(
    (s) => !/^verdict:/i.test(s.step.trim())
  );

  // Data for the canvas verdict card (drawn client-side in the share modal).
  const cardData: VerdictCardData | null = verdict
    ? {
        winnerName,
        candidateAName: candidateNames[0],
        candidateBName: candidateNames[1],
        scoreA: score?.a ?? 50,
        scoreB: score?.b ?? 50,
        veto: latestVeto
          ? {
              by: latestVeto.by,
              candidateName: vetoedName,
              reason: latestVeto.reason,
            }
          : null,
        evidence: proofSteps
          .filter((s) => /%/.test(s.step))
          .slice(0, 2)
          .map((s) => ({ label: s.evidence, pct: weightToPct(s.weight) })),
        evidenceFallbackNote: `Decided by ${proofSteps.length} evidence points.`,
        host:
          typeof window !== "undefined"
            ? window.location.host
            : "gavel-undeadash1010.vercel.app",
        dateLabel: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      }
    : null;

  return (
    <section
      aria-label="The verdict"
      aria-live="polite"
      className="stream-in rounded-lg bg-court-gold p-5 text-court-bg sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <GavelIcon className="h-9 w-9 shrink-0" />
          <h2 className="text-xl font-extrabold tracking-[0.12em] sm:text-2xl">
            THE VERDICT
          </h2>
        </div>

        {verdict && (
          <span className="ml-auto rounded bg-court-bg px-3 py-1.5 text-xs font-bold tracking-[0.18em] text-court-gold">
            DECISION · FINAL
          </span>
        )}
      </div>

      {verdict ? (
        <div className="mt-4">
          <p className="text-lg font-bold">{winnerName} wins.</p>
          <p className="mt-1 text-[15px] font-medium">{summary}</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {proofSteps.map((step, i) => {
              // Affinity steps already carry their percentage in the step
              // text; the evidence + raw weight would just repeat it.
              const isAffinity = /%/.test(step.step);
              const isVetoStep = /vetoes/i.test(step.step);
              const loser = (verdict?.loserName ?? "").toLowerCase();
              const isLoserStep =
                !isVetoStep &&
                loser !== "" &&
                step.step.toLowerCase().includes(loser);
              return (
                <li
                  key={i}
                  className={`flex flex-wrap items-baseline gap-x-2 rounded px-3 py-1.5 text-[13px] font-medium ${
                    isVetoStep
                      ? "border border-court-live/50 bg-court-live/10"
                      : isLoserStep
                        ? "bg-black/15 opacity-60"
                        : "bg-black/15"
                  }`}
                >
                  {isVetoStep && (
                    <span className="rounded bg-court-live px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.12em] text-white">
                      VETOED
                    </span>
                  )}
                  <span className="font-bold">{i + 1}.</span>
                  <span className="font-semibold">{step.step}</span>
                  {!isAffinity && (
                    <span className="opacity-80">{step.evidence}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setCardOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-court-bg px-6 text-base font-bold text-court-gold"
            >
              Share verdict
            </button>
          </div>
        </div>
      ) : (
        latestVeto && (
          <p className="mt-4 text-lg font-bold">
            <span className="veto-strike">{vetoedName}</span> VETOED ·{" "}
            {latestVeto.reason}
          </p>
        )
      )}
      {cardOpen && cardData && (
        <VerdictCardShare
          data={cardData}
          textFallback={buildShareText(
            winnerName,
            vetoes,
            proofSteps,
            typeof window !== "undefined" ? window.location.origin : ""
          )}
          onClose={() => setCardOpen(false)}
        />
      )}
    </section>
  );
}
