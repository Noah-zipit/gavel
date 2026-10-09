// Shared stateless debate setup for the stage-based API.
//
// Every stage recomputes group + candidates + Qloo scores from scratch, so no
// server-side session is needed. The RealQlooAdapter keeps a 10-minute
// in-memory cache, so repeat stages after the first are fast; on serverless
// cold starts the Qloo calls themselves are still quick (sub-second each).

import { getAdapter, withFallback } from "@/lib/evidence";
import { getDemoCandidates, getDemoGroup } from "@/lib/evidence/mock";
import { RealQlooAdapter } from "@/lib/evidence/qloo";
import type {
  Candidate,
  EvidenceAdapter,
  Person,
  ScoredCandidate,
} from "@/lib/evidence/types";

export interface DebateSetup {
  adapter: EvidenceAdapter;
  group: Person[];
  candidates: Candidate[];
  candidateA: Candidate;
  candidateB: Candidate;
  scoredByCandidate: Map<string, ScoredCandidate[]>;
  affinityByCandidate: Map<string, number>;
  affinityLines: Array<{
    personName: string;
    candidateId: string;
    affinity: number;
    label: string;
  }>;
  litNodeIds: string[];
}

function cuisineNodeId(personId: string, candidate: Candidate): string {
  return `${personId}-${candidate.cuisine.toLowerCase()}`;
}

export async function setupDebate(): Promise<DebateSetup> {
  const base = getAdapter();
  const adapter = withFallback(base);
  const isReal = base instanceof RealQlooAdapter;

  // Group: resolve seeds to entity ids for the real adapter, keep demo
  // identity (name/id) so the courtroom story stays legible. Resolved in
  // parallel — this is the slowest part of a cold stage.
  const demoGroup = getDemoGroup();
  const group: Person[] = isReal
    ? await Promise.all(
        demoGroup.map(async (p) => {
          const resolved = await adapter.resolvePerson(p.seeds);
          return { ...resolved, id: p.id, name: p.name };
        })
      )
    : demoGroup;

  const candidates = getDemoCandidates();
  const candidateA = candidates[0]!;
  const candidateB = candidates[1]!;

  // Score every person against every candidate in parallel.
  const scoredFlat = await Promise.all(
    candidates.flatMap((candidate) =>
      group.map(async (person) => ({
        candidateId: candidate.id,
        personName: person.name,
        personId: person.id,
        candidate,
        scored: await adapter.scoreCandidate(person, candidate),
      }))
    )
  );

  const scoredByCandidate = new Map<string, ScoredCandidate[]>();
  const affinityByCandidate = new Map<string, number>();
  const affinityLines: DebateSetup["affinityLines"] = [];
  const litNodeIds: string[] = [];
  for (const candidate of candidates) {
    const rows = scoredFlat.filter((r) => r.candidateId === candidate.id);
    const list = rows.map((r) => r.scored);
    for (const r of rows) {
      affinityLines.push({
        personName: r.personName,
        candidateId: r.candidateId,
        affinity: r.scored.affinity,
        label: r.scored.evidence[0]?.label ?? "taste-graph affinity",
      });
      litNodeIds.push(cuisineNodeId(r.personId, r.candidate));
    }
    scoredByCandidate.set(candidate.id, list);
    affinityByCandidate.set(
      candidate.id,
      list.reduce((sum, s) => sum + s.affinity, 0)
    );
  }

  return {
    adapter,
    group,
    candidates,
    candidateA,
    candidateB,
    scoredByCandidate,
    affinityByCandidate,
    affinityLines,
    litNodeIds,
  };
}

// Tug-of-war model, shared by server and documented for the client:
// each argument shifts the score by round(weight*12) toward its side,
// symmetric, clamped to 0..100.
export function applyShift(
  scoreA: number,
  scoreB: number,
  side: "A" | "B",
  weight: number
): { a: number; b: number } {
  const shift = Math.round(weight * 12);
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  if (side === "A") {
    return { a: clamp(scoreA + shift), b: clamp(scoreB - shift) };
  }
  return { a: clamp(scoreA - shift), b: clamp(scoreB + shift) };
}

export function scoreReason(
  side: "A" | "B",
  label: string,
  weight: number
): string {
  return `Advocate ${side} cites "${label}" (${Math.round(weight * 100)}%).`;
}
