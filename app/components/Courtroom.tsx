"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArgumentEvent,
  DebateSide,
  EvidenceEvent,
  ScoreEvent,
  VetoEvent,
  VerdictEvent,
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

const STAGE_URL = "/api/debate/stage";
const DRAMA_MS = 700;

interface StageArgument {
  text: string;
  evidence: { label: string; weight: number; detail?: string };
}

interface StageScore {
  a: number;
  b: number;
  delta: number;
  reason: string;
}

interface ArgumentStageResponse {
  stage: string;
  round: string;
  side: string;
  arguments: StageArgument[];
  scores: StageScore[];
  scoreA: number;
  scoreB: number;
  litNodes?: string[];
}

interface VerdictStageResponse {
  stage: string;
  vetoes: Array<{ candidateId: string; by: string; reason: string }>;
  verdict: { winnerId: string; loserId: string };
  proofChain: Array<{ step: string; evidence: string; weight: number }>;
  summary: string;
}

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const seenScores = useRef<Set<string>>(new Set());

  const stopRun = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const pushScore = useCallback((s: StageScore) => {
    const evt: ScoreEvent = { type: "score", ...s };
    const key = scoreKey(evt);
    if (seenScores.current.has(key)) return;
    seenScores.current.add(key);
    setScore(evt);
  }, []);

  const playArgumentStage = useCallback(
    async (
      runId: number,
      res: ArgumentStageResponse,
      round: string,
      side: DebateSide
    ): Promise<{ scoreA: number; scoreB: number; args: StageArgument[] }> => {
      // Light the evidence board once, when the trial opens.
      if (res.litNodes) {
        for (const nodeId of res.litNodes) {
          if (runIdRef.current !== runId) return { scoreA: res.scoreA, scoreB: res.scoreB, args: [] };
          const evt: EvidenceEvent = { type: "evidence", nodeId, lit: true };
          setLitNodes((prev) => new Set(prev).add(evt.nodeId));
          await pause(DRAMA_MS);
        }
      }
      for (let i = 0; i < res.arguments.length; i++) {
        if (runIdRef.current !== runId) break;
        const a = res.arguments[i]!;
        const evt: ArgumentEvent = {
          type: "argument",
          round,
          side,
          text: a.text,
          evidence: {
            label: a.evidence.label,
            weight: a.evidence.weight,
            detail: a.evidence.detail,
          },
        };
        setArgs((prev) => [...prev, evt]);
        await pause(DRAMA_MS);
        const s = res.scores[i];
        if (s) pushScore(s);
        await pause(DRAMA_MS);
      }
      return { scoreA: res.scoreA, scoreB: res.scoreB, args: res.arguments };
    },
    [pushScore]
  );

  const callStage = useCallback(
    async (
      runId: number,
      body: Record<string, unknown>
    ): Promise<ArgumentStageResponse | VerdictStageResponse> => {
      // One retry: serverless functions can cold-start or hit a slow NIM
      // call; stages are stateless and idempotent, so retrying is safe.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await pause(1500);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        try {
          const res = await fetch(STAGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            let detail = "";
            try {
              const data = await res.json();
              detail = typeof data.error === "string" ? `: ${data.error}` : "";
            } catch {
              // ignore
            }
            throw new Error(
              `stage "${String(body.stage)}" failed (HTTP ${res.status})${detail}`
            );
          }
          return (await res.json()) as ArgumentStageResponse | VerdictStageResponse;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err;
          lastError = err;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(`stage "${String(body.stage)}" failed`);
    },
    []
  );

  const start = useCallback(() => {
    // Duplicate-submission prevention: a live run is never started twice.
    if (abortRef.current) return;

    stopRun();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setArgs([]);
    setScore(null);
    setLitNodes(new Set());
    setVetoes([]);
    setVerdict(null);
    setErrorMsg(null);
    seenScores.current = new Set();
    setStatus("connecting");

    (async () => {
      try {
        let scoreA = 50;
        let scoreB = 50;

        setStatus("streaming");

        const openingA = (await callStage(runId, {
          stage: "opening-a",
          scoreA,
          scoreB,
        })) as ArgumentStageResponse;
        let out = await playArgumentStage(runId, openingA, "opening", "a");
        if (runIdRef.current !== runId) return;
        scoreA = out.scoreA;
        scoreB = out.scoreB;
        const argsA = out.args;

        const openingB = (await callStage(runId, {
          stage: "opening-b",
          scoreA,
          scoreB,
        })) as ArgumentStageResponse;
        out = await playArgumentStage(runId, openingB, "opening", "b");
        if (runIdRef.current !== runId) return;
        scoreA = out.scoreA;
        scoreB = out.scoreB;
        const argsB = out.args;

        const rebuttalA = (await callStage(runId, {
          stage: "rebuttal-a",
          scoreA,
          scoreB,
          opponentArgs: argsB,
        })) as ArgumentStageResponse;
        out = await playArgumentStage(runId, rebuttalA, "rebuttal", "a");
        if (runIdRef.current !== runId) return;
        scoreA = out.scoreA;
        scoreB = out.scoreB;

        const rebuttalB = (await callStage(runId, {
          stage: "rebuttal-b",
          scoreA,
          scoreB,
          opponentArgs: argsA,
        })) as ArgumentStageResponse;
        out = await playArgumentStage(runId, rebuttalB, "rebuttal", "b");
        if (runIdRef.current !== runId) return;

        const v = (await callStage(runId, {
          stage: "verdict",
        })) as VerdictStageResponse;
        if (runIdRef.current !== runId) return;

        for (const veto of v.vetoes) {
          if (runIdRef.current !== runId) return;
          const evt: VetoEvent = { type: "veto", ...veto };
          setVetoes((prev) => [...prev, evt]);
          await pause(DRAMA_MS);
        }
        if (runIdRef.current !== runId) return;

        const verdictEvt: VerdictEvent = {
          type: "verdict",
          winnerId: v.verdict.winnerId,
          loserId: v.verdict.loserId,
          proofChain: v.proofChain,
          summary: v.summary,
        };
        setVerdict(verdictEvt);
        await pause(DRAMA_MS);
        if (runIdRef.current !== runId) return;

        abortRef.current = null;
        setStatus("done");
      } catch (err) {
        if (runIdRef.current !== runId) return;
        abortRef.current = null;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "The debate failed before the judge ruled. The debate service may be unreachable."
        );
        setStatus("error");
      }
    })();
  }, [callStage, playArgumentStage, stopRun]);

  const reset = useCallback(() => {
    stopRun();
    setArgs([]);
    setScore(null);
    setLitNodes(new Set());
    setVetoes([]);
    setVerdict(null);
    setErrorMsg(null);
    seenScores.current = new Set();
    setStatus("idle");
  }, [stopRun]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
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
                  The trial failed
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
