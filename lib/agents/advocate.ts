// Advocate: one side of the courtroom (A or B), arguing for a candidate.
// Argument selection is genuinely evidence-driven: all Evidence across the
// group's ScoredCandidate entries is ranked by weight and the top three win;
// nothing is hard-coded. LLM renders the phrasing, with a deterministic
// template fallback so the debate always runs.

import type { Candidate, Evidence, ScoredCandidate } from "../evidence/types";
import { getLlm, type LlmAdapter } from "./llm";

export interface Argument {
  text: string;
  evidence: Evidence;
}

interface FlattenedEvidence extends Evidence {
  personId?: string;
}

export class Advocate {
  readonly side: "A" | "B";
  readonly candidate: Candidate;
  private llm: LlmAdapter;

  constructor(side: "A" | "B", candidate: Candidate) {
    this.side = side;
    this.candidate = candidate;
    this.llm = getLlm();
  }

  // All evidence across the group, ranked by weight, top N wins.
  private rankEvidence(scored: ScoredCandidate[], n: number): FlattenedEvidence[] {
    const all: FlattenedEvidence[] = [];
    for (const s of scored) {
      for (const e of s.evidence) {
        all.push({ ...e });
      }
    }
    all.sort((a, b) => b.weight - a.weight);
    // Drop exact duplicate labels to keep the three arguments distinct.
    const seen = new Set<string>();
    return all.filter((e) => {
      if (seen.has(e.label)) return false;
      seen.add(e.label);
      return true;
    }).slice(0, n);
  }

  private evidenceJsonBlock(
    kind: "opening" | "rebuttal",
    top: FlattenedEvidence,
    opponentSummary?: string
  ): string {
    const payload = {
      kind,
      candidate: this.candidate.name,
      topLabel: top.label,
      topDetail: top.detail,
      weight: top.weight,
      opponentSummary: opponentSummary ?? "",
    };
    return `[EVIDENCE_JSON]${JSON.stringify(payload)}[/EVIDENCE_JSON]`;
  }

  async buildOpening(evidence: ScoredCandidate[]): Promise<Argument[]> {
    const top = this.rankEvidence(evidence, 3);
    // Generate in parallel: cloud LLMs are slow per call, and the three
    // arguments are independent.
    return Promise.all(
      top.map(async (e) => {
        const prompt =
          `You are Advocate ${this.side} in the AI Courtroom, arguing FOR ${this.candidate.name} ` +
          `(${this.candidate.cuisine}, ${this.candidate.priceTier}) as tonight's group dinner pick. ` +
          `Write ONE forceful opening argument (2-3 sentences) grounded ONLY in the evidence below. ` +
          `Cite the evidence label and its weight naturally. No em dashes. ` +
          this.evidenceJsonBlock("opening", e);
        const text = await this.llm.generate(prompt);
        return {
          text,
          evidence: { label: e.label, weight: e.weight, detail: e.detail },
        };
      })
    );
  }

  async buildRebuttal(
    opponentArgs: Argument[],
    evidence: ScoredCandidate[]
  ): Promise<Argument[]> {
    const top = this.rankEvidence(evidence, 3);
    return Promise.all(
      top.map(async (e, i) => {
        const opponent = opponentArgs[i] ?? opponentArgs[0];
        const opponentSummary = opponent
          ? opponent.text.split(".")[0]!.slice(0, 220)
          : "the opposition's opening claims.";
        const prompt =
          `You are Advocate ${this.side} in the AI Courtroom, arguing FOR ${this.candidate.name} ` +
          `(${this.candidate.cuisine}, ${this.candidate.priceTier}). The opposition just argued: ` +
          `"${opponentSummary}" Rebut it in ONE sharp rebuttal (2-3 sentences) grounded ONLY in the ` +
          `evidence below. Cite the evidence label and weight naturally. No em dashes. ` +
          this.evidenceJsonBlock("rebuttal", e, opponentSummary);
        const text = await this.llm.generate(prompt);
        return {
          text,
          evidence: { label: e.label, weight: e.weight, detail: e.detail },
        };
      })
    );
  }
}
