// GET /api/debate?group=friends-lahore
//
// Streams the AI Courtroom debate as Server-Sent Events. Event order:
// opening A -> opening B -> rebuttal A -> rebuttal B -> veto check -> verdict.
//
// Score model: start 50/50; each argument shifts by round(weight*12) toward
// its side (symmetric), clamped 0..100. Errors emit {type:"error"} and close.

import type { NextRequest } from "next/server";
import { Advocate } from "@/lib/agents/advocate";
import { Judge } from "@/lib/agents/judge";
import { getAdapter, withFallback } from "@/lib/evidence";
import { getDemoCandidates, getDemoGroup } from "@/lib/evidence/mock";
import { RealQlooAdapter } from "@/lib/evidence/qloo";
import type {
  Candidate,
  Person,
  ScoredCandidate,
} from "@/lib/evidence/types";

const DRAMA_DELAY_MS = 700;

async function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampScore(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function cuisineNodeId(personId: string, candidate: Candidate): string {
  return `${personId}-${candidate.cuisine.toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  const groupParam = request.nextUrl.searchParams.get("group") ?? "friends-lahore";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      const close = () => controller.close();

      try {
        if (groupParam !== "friends-lahore") {
          send({ type: "error", message: `unknown group "${groupParam}"` });
          close();
          return;
        }

        const base = getAdapter();
        const adapter = withFallback(base);
        const isReal = base instanceof RealQlooAdapter;

        // Group: resolve seeds to entity ids for the real adapter, keep demo
        // identity (name/id) so the courtroom story stays legible.
        let group: Person[];
        if (isReal) {
          group = [];
          for (const p of getDemoGroup()) {
            const resolved = await adapter.resolvePerson(p.seeds);
            group.push({ ...resolved, id: p.id, name: p.name });
          }
        } else {
          group = getDemoGroup();
        }

        const candidates = getDemoCandidates();
        const candidateA = candidates[0]!;
        const candidateB = candidates[1]!;

        // 1. Score every person against every candidate.
        const scoredByCandidate = new Map<string, ScoredCandidate[]>();
        const affinityByCandidate = new Map<string, number>();
        const affinityLines: Array<{
          personName: string;
          candidateId: string;
          affinity: number;
          label: string;
        }> = [];
        for (const candidate of candidates) {
          const list: ScoredCandidate[] = [];
          for (const person of group) {
            const scored = await adapter.scoreCandidate(person, candidate);
            list.push(scored);
            affinityLines.push({
              personName: person.name,
              candidateId: candidate.id,
              affinity: scored.affinity,
              label: scored.evidence[0]?.label ?? "taste-graph affinity",
            });
          }
          scoredByCandidate.set(candidate.id, list);
          affinityByCandidate.set(
            candidate.id,
            list.reduce((sum, s) => sum + s.affinity, 0)
          );
        }

        // 2. Light up the evidence board as affinities resolve.
        for (const line of affinityLines) {
          const cand = candidates.find((c) => c.id === line.candidateId)!;
          const person = group.find((p) => p.name === line.personName)!;
          send({ type: "evidence", nodeId: cuisineNodeId(person.id, cand), lit: true });
          await pause(DRAMA_DELAY_MS);
        }

        // 3. Run the debate: opening A -> opening B -> rebuttal A -> rebuttal B.
        let scoreA = 50;
        let scoreB = 50;

        const advocateA = new Advocate("A", candidateA);
        const advocateB = new Advocate("B", candidateB);

        const emitArguments = async (
          round: "opening" | "rebuttal",
          side: "A" | "B",
          args: Array<{ text: string; evidence: { label: string; weight: number; detail: string } }>
        ) => {
          for (const arg of args) {
            const shift = Math.round(arg.evidence.weight * 12);
            if (side === "A") {
              scoreA = clampScore(scoreA + shift);
              scoreB = clampScore(scoreB - shift);
            } else {
              scoreB = clampScore(scoreB + shift);
              scoreA = clampScore(scoreA - shift);
            }
            send({
              type: "argument",
              round,
              side,
              text: arg.text,
              evidence: arg.evidence,
            });
            await pause(DRAMA_DELAY_MS);
            send({
              type: "score",
              a: scoreA,
              b: scoreB,
              delta: scoreA - scoreB,
              reason: `Advocate ${side} cites "${arg.evidence.label}" (${Math.round(arg.evidence.weight * 100)}%).`,
            });
            await pause(DRAMA_DELAY_MS);
          }
        };

        const openingA = await advocateA.buildOpening(
          scoredByCandidate.get(candidateA.id) ?? []
        );
        const openingB = await advocateB.buildOpening(
          scoredByCandidate.get(candidateB.id) ?? []
        );
        const rebuttalA = await advocateA.buildRebuttal(
          openingB,
          scoredByCandidate.get(candidateA.id) ?? []
        );
        const rebuttalB = await advocateB.buildRebuttal(
          openingA,
          scoredByCandidate.get(candidateB.id) ?? []
        );

        await emitArguments("opening", "A", openingA);
        await emitArguments("opening", "B", openingB);
        await emitArguments("rebuttal", "A", rebuttalA);
        await emitArguments("rebuttal", "B", rebuttalB);

        // 4. Veto check.
        const judge = new Judge();
        const vetoes = await judge.checkVetoes(group, candidates, adapter);
        for (const candidate of candidates) {
          for (const veto of vetoes.get(candidate.id) ?? []) {
            send({
              type: "veto",
              candidateId: candidate.id,
              by: veto.person.name,
              reason: veto.reason,
            });
            await pause(DRAMA_DELAY_MS);
          }
        }

        // 5. Verdict.
        const scores: Record<string, number> = {};
        for (const [id, total] of affinityByCandidate) {
          scores[id] = total;
        }
        const decision = judge.decide(candidates, scores, vetoes);
        const proofChain = judge.assembleProofChain({
          candidates,
          scores,
          vetoes,
          decision,
          affinityLines,
        });
        const winner = candidates.find((c) => c.id === decision.winnerId)!;
        send({
          type: "verdict",
          winnerId: decision.winnerId,
          loserId: decision.loserId,
          proofChain,
          summary: `THE VERDICT: ${winner.name}. ${decision.reason}`,
        });
        await pause(DRAMA_DELAY_MS);

        send({ type: "done" });
        close();
      } catch (err) {
        // Never leak internals; the key is never present in these code paths.
        send({
          type: "error",
          message: err instanceof Error ? err.message : "debate failed",
        });
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
