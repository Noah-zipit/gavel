"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseDebateEvent,
  type ArgumentEvent,
  type DebateEvent,
  type EvidenceEvent,
  type ScoreEvent,
  type VetoEvent,
  type VerdictEvent,
} from "@/lib/debate-events";
import Header from "./Header";
import CandidateCard from "./CandidateCard";
import TugOfWar from "./TugOfWar";
import Transcript from "./Transcript";
import EvidenceBoard from "./EvidenceBoard";
import VerdictBanner from "./VerdictBanner";
import { CANDIDATES } from "./candidates";
import { GavelIcon } from "./icons";

type Status = "idle" | "connecting" | "streaming" | "done" | "error";

const STREAM_URL = "/api/debate?group=friends-lahore";

function scoreKey(e: ScoreEvent) {
  return `${e.a}|${e.b}|${e.delta}|${e.reason}`;
}

export default function Courtroom() {
  const [status, setStatus] = useState<Status>("idle");
  const [args, setArgs] = useState<ArgumentEvent[]>([]);
  const [score, setScore] = useState<ScoreEvent | null>(null);
  const [litNodes, setLitNodes] = useState<Set<string>>(new Set());
  const [vetoes, setVetoes] = useState<VetoEvent[]>([]);
  const [verdict, setVerdict] = useState<VerdictEvent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const doneRef = useRef(false);
  const seenScores = useRef<Set<string>>(new Set());

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const handleEvent = useCallback((evt: DebateEvent) => {
    switch (evt.type) {
      case "argument":
        setArgs((prev) => [...prev, evt]);
        break;
      case "score": {
        const key = scoreKey(evt);
        if (seenScores.current.has(key)) break;
        seenScores.current.add(key);
        setScore(evt);
        break;
      }
      case "evidence": {
        const e: EvidenceEvent = evt;
        setLitNodes((prev) => {
          const next = new Set(prev);
          if (e.lit) next.add(e.nodeId);
          else next.delete(e.nodeId);
          return next;
        });
        break;
      }
      case "veto":
        setVetoes((prev) => [...prev, evt]);
        break;
      case "verdict":
        setVerdict(evt);
        break;
      case "done":
        doneRef.current = true;
        closeStream();
        setStatus("done");
        break;
      case "error":
        doneRef.current = true;
        closeStream();
        setErrorMsg(evt.message);
        setStatus("error");
        break;
    }
  }, [closeStream]);

  const start = useCallback(() => {
    // Duplicate-submission prevention: a live stream is never opened twice.
    if (esRef.current) return;

    setArgs([]);
    setScore(null);
    setLitNodes(new Set());
    setVetoes([]);
    setVerdict(null);
    setErrorMsg(null);
    seenScores.current = new Set();
    doneRef.current = false;
    setStatus("connecting");

    const es = new EventSource(STREAM_URL);
    esRef.current = es;

    es.onopen = () => setStatus("streaming");

    es.onmessage = (m: MessageEvent<string>) => {
      const evt = parseDebateEvent(m.data);
      if (evt) handleEvent(evt);
    };

    es.onerror = () => {
      const finished = doneRef.current;
      closeStream();
      if (finished) {
        setStatus("done");
      } else {
        setErrorMsg(
          "The debate stream dropped before the judge ruled. The connection may be down or the debate service is unreachable."
        );
        setStatus("error");
      }
    };
  }, [closeStream, handleEvent]);

  const reset = useCallback(() => {
    closeStream();
    setArgs([]);
    setScore(null);
    setLitNodes(new Set());
    setVetoes([]);
    setVerdict(null);
    setErrorMsg(null);
    seenScores.current = new Set();
    doneRef.current = false;
    setStatus("idle");
  }, [closeStream]);

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const busy = status === "connecting" || status === "streaming";
  const showArena = status === "streaming" || status === "done" || status === "error";
  const matchA = score ? score.a : CANDIDATES[0].initialMatch;
  const matchB = score ? score.b : CANDIDATES[1].initialMatch;
  const vetoedIds = new Set(vetoes.map((v) => v.candidateId));

  return (
    <div className="flex min-h-screen flex-col bg-court-bg text-court-text">
      <Header live={busy} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-court-amber px-6 text-base font-bold text-[#15171c] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "connecting"
              ? "Convening…"
              : status === "streaming"
                ? "Trial in session"
                : "Start the trial"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={status === "idle"}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-court-border px-6 text-base font-semibold text-court-text transition-colors hover:border-court-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset
          </button>
          {status === "done" && (
            <p className="text-sm font-medium text-court-muted">
              Session closed. The record stands above.
            </p>
          )}
        </div>

        {/* Empty state */}
        {status === "idle" && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-court-border px-6 py-16 text-center">
            <GavelIcon className="h-12 w-12 text-court-muted" />
            <h2 className="mt-4 text-xl font-bold text-court-text">
              No trial convened yet
            </h2>
            <p className="mt-2 max-w-md text-[15px] text-court-muted">
              Start the trial and two advocate agents will argue where the
              group eats, citing live taste-graph evidence, until the judge
              delivers a verdict.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-court-amber px-6 text-base font-bold text-[#15171c]"
            >
              Start the trial
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {status === "connecting" && (
          <div
            className="flex flex-1 flex-col gap-4"
            role="status"
            aria-label="Convening the court"
          >
            <p className="text-center text-lg font-semibold text-court-text">
              Convening the court…
            </p>
            <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
              <div className="skeleton-block h-44 rounded-lg" />
              <div className="skeleton-block h-44 rounded-lg" />
            </div>
            <div className="skeleton-block h-40 rounded-lg" aria-hidden="true" />
            <div className="skeleton-block h-56 rounded-lg" aria-hidden="true" />
          </div>
        )}

        {/* Arena */}
        {showArena && (
          <>
            {status === "error" && (
              <div
                role="alert"
                className="rounded-lg border border-court-live bg-court-panel p-5"
              >
                <h2 className="text-lg font-bold text-court-live">
                  The stream failed
                </h2>
                <p className="mt-1.5 text-[15px] text-court-text">{errorMsg}</p>
                <button
                  type="button"
                  onClick={start}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-court-amber px-6 text-base font-bold text-[#15171c]"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="grid items-center gap-4 md:grid-cols-[1fr_minmax(180px,240px)_1fr]">
              <CandidateCard
                candidate={CANDIDATES[0]}
                match={matchA}
                vetoed={vetoedIds.has(CANDIDATES[0].id)}
              />
              <div className="px-1 md:px-2">
                <TugOfWar
                  a={score ? score.a : 50}
                  b={score ? score.b : 50}
                  delta={score ? score.delta : 0}
                  reason={score ? score.reason : ""}
                />
              </div>
              <CandidateCard
                candidate={CANDIDATES[1]}
                match={matchB}
                vetoed={vetoedIds.has(CANDIDATES[1].id)}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <Transcript items={args} streaming={status === "streaming"} />
              <EvidenceBoard litNodes={litNodes} />
            </div>

            <VerdictBanner vetoes={vetoes} verdict={verdict} />
          </>
        )}
      </main>

      <footer className="border-t border-court-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-court-muted sm:px-6">
          Gavel · The Disagreement Engine. Two advocates argue, one judge
          rules, every claim carries its evidence.
        </p>
      </footer>
    </div>
  );
}
