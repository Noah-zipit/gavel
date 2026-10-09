// POST /api/debate/stage — one self-contained debate stage per call.
//
// The courtroom debate is split into five quick stages so each serverless
// invocation finishes well under function timeouts:
//
//   opening-a  -> 3 parallel Advocate A openings (+ evidence-board node ids)
//   opening-b  -> 3 parallel Advocate B openings
//   rebuttal-a -> 3 parallel Advocate A rebuttals (body.opponentArgs = B openings)
//   rebuttal-b -> 3 parallel Advocate B rebuttals (body.opponentArgs = A openings)
//   verdict    -> judge veto check + decision + proof chain
//
// Stateless: every call recomputes group + candidates + taste scores. The
// Qloo adapter's 10-minute cache makes repeat stages fast.
//
// Scoring (tug-of-war, kept from the original stream): the client sends the
// running scoreA/scoreB (default 50/50); the server applies each new
// argument's shift (round(weight*12), symmetric, clamped 0..100) and returns
// per-argument score snapshots plus the updated totals, so the client can
// replay the drama without duplicating the model.

import type { NextRequest } from "next/server";
import { Advocate, type Argument } from "@/lib/agents/advocate";
import { Judge } from "@/lib/agents/judge";
import {
  applyShift,
  scoreReason,
  setupDebate,
  type CustomDebateInput,
} from "@/lib/debate-setup";
import type { Evidence } from "@/lib/evidence/types";

// Vercel Hobby functions cap at 60s; each stage is designed to finish well
// under that (3 parallel NIM calls ≈ 30s worst case).
export const maxDuration = 60;

const STAGES = [
  "opening-a",
  "opening-b",
  "rebuttal-a",
  "rebuttal-b",
  "verdict",
] as const;

type Stage = (typeof STAGES)[number];

interface BodyArg {
  text: string;
  evidence: { label: string; weight: number; detail?: string };
}

function toEvidence(e: BodyArg["evidence"]): Evidence {
  return { label: e.label, weight: e.weight, detail: e.detail ?? "" };
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  let body: {
    stage?: unknown;
    scoreA?: unknown;
    scoreB?: unknown;
    opponentArgs?: unknown;
    people?: unknown;
    candidates?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return bad("request body must be JSON");
  }

  const stage = body.stage;
  if (typeof stage !== "string" || !(STAGES as readonly string[]).includes(stage)) {
    return bad(`stage must be one of: ${STAGES.join(", ")}`);
  }

  // Running tug-of-war scores supplied by the client (default 50/50).
  const startA = typeof body.scoreA === "number" ? body.scoreA : 50;
  const startB = typeof body.scoreB === "number" ? body.scoreB : 50;

  // Custom debate input (setup screen). Absent -> demo fixtures.
  let customInput: CustomDebateInput | undefined;
  if (body.people !== undefined || body.candidates !== undefined) {
    if (!Array.isArray(body.people) || !Array.isArray(body.candidates)) {
      return bad("people and candidates must be arrays");
    }
    customInput = {
      people: (body.people as Array<Record<string, unknown>>).map((p) => ({
        name: String(p.name ?? ""),
        seeds: Array.isArray(p.seeds)
          ? p.seeds.map((s) => String(s))
          : String(p.seeds ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      })),
      candidates: (body.candidates as Array<Record<string, unknown>>).map(
        (c) => ({
          name: String(c.name ?? ""),
          keywords: String(c.keywords ?? ""),
          priceTier: String(c.priceTier ?? "$$"),
        })
      ),
    };
  }

  try {
    const setup = await setupDebate(customInput);
    const { candidateA, candidateB, scoredByCandidate } = setup;

    // ---- Argument stages ----
    if (stage !== "verdict") {
      const side: "A" | "B" = stage.endsWith("-b") ? "B" : "A";
      const candidate = side === "A" ? candidateA : candidateB;
      const advocate = new Advocate(side, candidate);
      const scored = scoredByCandidate.get(candidate.id) ?? [];

      let args: Array<{ text: string; evidence: Evidence }>;
      if (stage.startsWith("rebuttal")) {
        const raw = body.opponentArgs;
        if (!Array.isArray(raw) || raw.length === 0) {
          return bad(`${stage} requires body.opponentArgs (the opponent's openings)`);
        }
        const opponentArgs: Argument[] = raw.map((r) => {
          const b = r as BodyArg;
          return {
            text: String(b.text ?? ""),
            evidence: toEvidence(b.evidence ?? { label: "", weight: 0 }),
          };
        });
        args = await advocate.buildRebuttal(opponentArgs, scored);
      } else {
        args = await advocate.buildOpening(scored);
      }

      // Apply the tug-of-war model in argument order; snapshot after each.
      let a = startA;
      let b = startB;
      const scores = args.map((arg) => {
        const next = applyShift(a, b, side, arg.evidence.weight);
        a = next.a;
        b = next.b;
        return {
          a,
          b,
          delta: a - b,
          reason: scoreReason(side, arg.evidence.label, arg.evidence.weight),
        };
      });

      const round = stage.startsWith("rebuttal") ? "rebuttal" : "opening";
      return Response.json({
        stage,
        round,
        side: side.toLowerCase(),
        arguments: args.map((arg) => ({
          text: arg.text,
          evidence: {
            label: arg.evidence.label,
            weight: arg.evidence.weight,
            detail: arg.evidence.detail,
          },
        })),
        scores,
        scoreA: a,
        scoreB: b,
        // The client lights the evidence board once, when the debate opens.
        // Board nodes + candidate cards are built dynamically from these.
        ...(stage === "opening-a"
          ? {
              litNodes: setup.litNodeIds,
              boardNodes: setup.boardNodes,
              candidates: setup.candidates.map((c, i) => ({
                id: c.id,
                name: c.name,
                side: i === 0 ? "a" : "b",
                keywords: c.keywords ?? c.cuisine,
                priceTier: c.priceTier,
              })),
              groupSize: setup.group.length,
            }
          : {}),
      });
    }

    // ---- Verdict stage ----
    // The verdict is evidence-based (group taste-affinity totals), not
    // debate-performance-based — identical to the original stream's logic.
    const judge = new Judge();
    const vetoes = await judge.checkVetoes(
      setup.group,
      setup.candidates,
      setup.adapter
    );

    const scores: Record<string, number> = {};
    for (const [id, total] of setup.affinityByCandidate) {
      scores[id] = total;
    }
    const decision = judge.decide(setup.candidates, scores, vetoes);
    const proofChain = judge.assembleProofChain({
      candidates: setup.candidates,
      scores,
      vetoes,
      decision,
      affinityLines: setup.affinityLines,
    });
    const winner = setup.candidates.find((c) => c.id === decision.winnerId)!;

    const vetoList: Array<{
      candidateId: string;
      candidateName: string;
      by: string;
      reason: string;
    }> = [];
    for (const candidate of setup.candidates) {
      for (const veto of vetoes.get(candidate.id) ?? []) {
        vetoList.push({
          candidateId: candidate.id,
          candidateName: candidate.name,
          by: veto.person.name,
          reason: veto.reason,
        });
      }
    }

    return Response.json({
      stage,
      vetoes: vetoList,
      verdict: {
        winnerId: decision.winnerId,
        winnerName: winner.name,
        loserId: decision.loserId,
        loserName: setup.candidates.find((c) => c.id === decision.loserId)?.name ?? decision.loserId,
      },
      proofChain,
      summary: `THE VERDICT: ${winner.name}. ${decision.reason}`,
    });
  } catch (err) {
    // Never leak internals or key material.
    console.error(`debate stage "${String(stage)}" failed`);
    return Response.json(
      { error: err instanceof Error ? err.message : "debate stage failed" },
      { status: 500 }
    );
  }
}
