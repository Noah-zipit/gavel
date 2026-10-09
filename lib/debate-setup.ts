// Shared stateless debate setup for the stage-based API.
//
// Every stage recomputes group + candidates + taste scores from scratch, so no
// server-side session is needed. Adapters keep a 10-minute in-memory cache,
// so repeat stages after the first are fast.
//
// Two modes:
//   - Demo (no input, or input matching the demo fixtures): hand-authored
//     MockQlooAdapter with the scripted veto plot (Sara vetoes sushi).
//   - Custom (user-supplied people/candidates): CustomQlooAdapter scores real
//     Qloo /search entity data via keyword + tag-overlap affinity.

import { getAdapter, withFallback } from "@/lib/evidence";
import { CustomQlooAdapter } from "@/lib/evidence/custom";
import { getDemoCandidates, getDemoGroup } from "@/lib/evidence/mock";
import { RealQlooAdapter } from "@/lib/evidence/qloo";
import type {
  Candidate,
  EvidenceAdapter,
  Person,
  ScoredCandidate,
} from "@/lib/evidence/types";

export interface CustomPersonInput {
  name: string;
  /** taste keywords, e.g. ["sushi", "jazz"] or ["no raw fish"] */
  seeds: string[];
}

export interface CustomCandidateInput {
  name: string;
  /** free-text descriptors, e.g. "Italian restaurant, family" */
  keywords: string;
  priceTier: string;
}

export interface CustomDebateInput {
  people: CustomPersonInput[];
  candidates: CustomCandidateInput[];
}

export interface BoardNode {
  id: string;
  personName: string;
  candidateName: string;
  /** 0-100 affinity, for the node label */
  weight: number;
  /** candidate index -> tone */
  candidateIndex: number;
}

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
  boardNodes: BoardNode[];
  isCustom: boolean;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "x"
  );
}

function nodeId(personId: string, candidateId: string): string {
  return `${personId}::${candidateId}`;
}

/** The pre-filled demo data uses the mock adapter to preserve the veto plot. */
function isDemoInput(input: CustomDebateInput): boolean {
  const demoPeople = ["alex", "sara", "jordan", "micah"];
  const demoCands = ["casa di roma", "sakura sushi"];
  if (input.people.length !== 4 || input.candidates.length !== 2) return false;
  const pn = input.people.map((p) => p.name.trim().toLowerCase());
  const cn = input.candidates.map((c) => c.name.trim().toLowerCase());
  return (
    demoPeople.every((n, i) => pn[i] === n) &&
    demoCands.every((n, i) => cn[i] === n)
  );
}

function validateCustomInput(input: CustomDebateInput): void {
  if (input.people.length < 2 || input.people.length > 6) {
    throw new Error("need 2–6 people");
  }
  if (input.candidates.length < 2 || input.candidates.length > 4) {
    throw new Error("need 2–4 candidates");
  }
  for (const p of input.people) {
    if (!p.name.trim()) throw new Error("every person needs a name");
    if (!p.seeds.some((s) => s.trim())) {
      throw new Error(`${p.name} needs at least one taste keyword`);
    }
  }
  for (const c of input.candidates) {
    if (!c.name.trim()) throw new Error("every candidate needs a name");
  }
}

export async function setupDebate(
  input?: CustomDebateInput
): Promise<DebateSetup> {
  const useCustom = input !== undefined && !isDemoInput(input);
  if (useCustom) validateCustomInput(input!);

  let adapter: EvidenceAdapter;
  let group: Person[];
  let candidates: Candidate[];

  if (!useCustom) {
    // Demo path: mock adapter, hand-authored fixtures.
    const base = getAdapter();
    adapter = withFallback(base);
    const isReal = base instanceof RealQlooAdapter;
    const demoGroup = getDemoGroup();
    group = isReal
      ? await Promise.all(
          demoGroup.map(async (p) => {
            const resolved = await adapter.resolvePerson(p.seeds);
            return { ...resolved, id: p.id, name: p.name };
          })
        )
      : demoGroup;
    candidates = getDemoCandidates();
  } else {
    // Custom path: real Qloo scoring from /search entity data.
    const custom = new CustomQlooAdapter();
    adapter = custom;
    group = await Promise.all(
      input!.people.map((p) =>
        custom.resolvePerson(p.seeds.map((s) => s.trim()).filter(Boolean))
      )
    );
    // Fix display names (resolvePerson uses seeds[0] as name).
    group = group.map((g, i) => ({ ...g, name: input!.people[i]!.name.trim() }));
    candidates = input!.candidates.map((c, i) => ({
      id: `custom-${slugify(c.name)}-${i}`,
      name: c.name.trim(),
      cuisine: c.keywords.trim().split(",")[0]?.trim() || c.keywords.trim(),
      priceTier: c.priceTier || "$$",
      distanceMi: 0,
      rating: 0,
      keywords: c.keywords.trim(),
    }));
  }

  const candidateA = candidates[0]!;
  const candidateB = candidates[1]!;

  // Score every person against every candidate in parallel.
  const scoredFlat = await Promise.all(
    candidates.flatMap((candidate) =>
      group.map(async (person) => ({
        candidateId: candidate.id,
        candidateIndex: candidates.indexOf(candidate),
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
  const boardNodes: BoardNode[] = [];
  for (const candidate of candidates) {
    const cIdx = candidates.indexOf(candidate);
    const rows = scoredFlat.filter((r) => r.candidateId === candidate.id);
    const list = rows.map((r) => r.scored);
    for (const r of rows) {
      const nid = nodeId(r.personId, r.candidateId);
      affinityLines.push({
        personName: r.personName,
        candidateId: r.candidateId,
        affinity: r.scored.affinity,
        label: r.scored.evidence[0]?.label ?? "taste-graph affinity",
      });
      litNodeIds.push(nid);
      boardNodes.push({
        id: nid,
        personName: r.personName,
        candidateName: candidate.name,
        weight: Math.round(r.scored.affinity * 100),
        candidateIndex: cIdx,
      });
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
    boardNodes,
    isCustom: useCustom,
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
