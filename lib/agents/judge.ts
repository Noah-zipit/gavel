// Judge: the neutral decider. Veto checks and the decision are fully
// deterministic: any affinity under 0.30 disqualifies a candidate, and a
// vetoed candidate loses automatically regardless of score.

import type {
  Candidate,
  EvidenceAdapter,
  Person,
  Veto,
} from "../evidence/types";

export const VETO_THRESHOLD = 0.3;

export interface ProofStep {
  step: string;
  evidence: string;
  weight: number;
}

export interface Decision {
  winnerId: string;
  loserId: string;
  reason: string;
}

export class Judge {
  // Deterministic: delegates scoring to the adapter, flags any affinity < 0.30.
  async checkVetoes(
    group: Person[],
    candidates: Candidate[],
    adapter: EvidenceAdapter
  ): Promise<Map<string, Veto[]>> {
    const result = new Map<string, Veto[]>();
    for (const candidate of candidates) {
      const vetoes = await adapter.getVetoes(group, candidate);
      result.set(candidate.id, vetoes);
    }
    return result;
  }

  // Vetoed candidates lose automatically; otherwise the higher total score wins.
  decide(
    candidates: Candidate[],
    scores: Record<string, number>,
    vetoes: Map<string, Veto[]>
  ): Decision {
    const eligible = candidates.filter(
      (c) => (vetoes.get(c.id) ?? []).length === 0
    );

    if (eligible.length === 0) {
      throw new Error("judge: every candidate was vetoed; no decision possible");
    }

    const vetoed = candidates.filter((c) => !eligible.includes(c));
    if (vetoed.length > 0) {
      const winner = this.topScorer(eligible, scores);
      const loser = vetoed[0]!;
      const loserVetoes = vetoes.get(loser.id) ?? [];
      return {
        winnerId: winner.id,
        loserId: loser.id,
        reason: `${loser.name} was vetoed by ${
          loserVetoes.map((v) => v.person.name).join(", ") || "the group"
        }. A vetoed candidate cannot win, so ${winner.name} takes it.`,
      };
    }

    const [first, second] = this.ranked(candidates, scores);
    return {
      winnerId: first!.id,
      loserId: second!.id,
      reason: `${first!.name} outscored ${second!.name} ${
        scores[first!.id]!.toFixed(2)
      } to ${scores[second!.id]!.toFixed(2)} on group taste affinity.`,
    };
  }

  private ranked(candidates: Candidate[], scores: Record<string, number>): Candidate[] {
    return [...candidates].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  }

  private topScorer(eligible: Candidate[], scores: Record<string, number>): Candidate {
    return this.ranked(eligible, scores)[0]!;
  }

  // Ordered proof chain narrating the decision, heaviest evidence first.
  assembleProofChain(input: {
    candidates: Candidate[];
    scores: Record<string, number>;
    vetoes: Map<string, Veto[]>;
    decision: Decision;
    affinityLines: Array<{ personName: string; candidateId: string; affinity: number; label: string }>;
  }): ProofStep[] {
    const { candidates, scores, vetoes, decision, affinityLines } = input;
    const steps: ProofStep[] = [];

    const loser = candidates.find((c) => c.id === decision.loserId);
    const loserVetoes = vetoes.get(decision.loserId) ?? [];
    for (const veto of loserVetoes) {
      steps.push({
        step: `${veto.person.name} vetoes ${loser?.name ?? "the candidate"}: affinity below ${VETO_THRESHOLD}`,
        evidence: veto.reason,
        weight: 1.0,
      });
    }

    const rankedLines = [...affinityLines].sort((a, b) => b.affinity - a.affinity);
    for (const line of rankedLines) {
      const cand = candidates.find((c) => c.id === line.candidateId);
      steps.push({
        step: `${line.personName} → ${cand?.name ?? line.candidateId}: ${Math.round(line.affinity * 100)}% affinity`,
        evidence: line.label,
        weight: Math.round(line.affinity * 100) / 100,
      });
    }

    const winner = candidates.find((c) => c.id === decision.winnerId);
    steps.push({
      step: `Verdict: ${winner?.name ?? decision.winnerId} wins`,
      evidence: decision.reason,
      weight: Math.round((scores[decision.winnerId] ?? 0) * 100) / 100,
    });

    return steps;
  }
}
