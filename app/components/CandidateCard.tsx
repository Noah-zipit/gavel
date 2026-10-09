"use client";

import type { DisplayCandidate } from "./candidates";
import { FilmIcon, StarIcon, UtensilsIcon } from "./icons";

interface CandidateCardProps {
  candidate: DisplayCandidate;
  /** live match %, driven by score events */
  match: number;
  /** true once a veto event names this candidate */
  vetoed: boolean;
}

export default function CandidateCard({
  candidate,
  match,
  vetoed,
}: CandidateCardProps) {
  const isA = candidate.side === "a";
  const accent = isA ? "text-court-amber" : "text-court-teal";
  const border = isA ? "border-court-amber" : "border-court-teal";
  const chip = isA ? "bg-court-amber/15 text-court-amber" : "bg-court-teal/15 text-court-teal";
  const DomainIcon = candidate.domain === "movies" ? FilmIcon : UtensilsIcon;

  return (
    <article
      aria-label={`${candidate.name}${vetoed ? ", vetoed" : ""}`}
      className={`rounded-lg border-2 bg-court-panel p-5 sm:p-6 ${border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={`text-2xl font-bold ${accent}`}>
          {vetoed ? (
            <span className="veto-strike" aria-label={`${candidate.name} vetoed`}>
              {candidate.name}
            </span>
          ) : (
            candidate.name
          )}
        </h2>
        <DomainIcon className={`h-10 w-10 shrink-0 ${accent}`} />
      </div>

      {candidate.tags.length > 0 && (
        <p className="mt-2 text-sm font-medium text-court-text">
          {candidate.tags.join(" · ")}
        </p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-court-text">
        {candidate.rating !== undefined && (
          <>
            <StarIcon className={`h-4 w-4 ${accent}`} />
            <span className="font-semibold">{candidate.rating.toFixed(1)}</span>
            <span aria-hidden="true" className="text-court-muted">·</span>
          </>
        )}
        {candidate.distance && (
          <>
            <span>{candidate.distance}</span>
            <span aria-hidden="true" className="text-court-muted">·</span>
          </>
        )}
        {candidate.price && (
          <>
            <span>{candidate.price}</span>
            <span aria-hidden="true" className="text-court-muted">·</span>
          </>
        )}
        <span className="font-semibold" aria-live="off">
          {Math.round(match)}% match
        </span>
      </p>

      {candidate.pros && (
        <p className={`mt-4 rounded-md px-3 py-2.5 text-sm font-medium ${chip}`}>
          <span className="font-bold">Pros:</span> {candidate.pros}
        </p>
      )}
    </article>
  );
}
