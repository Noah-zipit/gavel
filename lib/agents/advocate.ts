// Advocate: one side of the courtroom (A or B), arguing for a candidate.
// Argument selection is genuinely evidence-driven: all Evidence across the
// group's ScoredCandidate entries is ranked by weight and the top three win;
// nothing is hard-coded. LLM renders the phrasing, with a deterministic
// template fallback so the debate always runs.

import type {
  Candidate,
  DebateDomain,
  Evidence,
  ScoredCandidate,
} from "../evidence/types";
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
  readonly domain: DebateDomain;
  private llm: LlmAdapter;

  constructor(side: "A" | "B", candidate: Candidate, domain: DebateDomain = "dining") {
    this.side = side;
    this.candidate = candidate;
    this.domain = domain;
    this.llm = getLlm();
  }

  /** "tonight's group dinner pick" vs "tonight's group movie pick", etc. */
  private get pickNoun(): string {
    return this.domain === "movies"
      ? "tonight's group movie pick"
      : "tonight's group dinner pick";
  }

  /** Each advocate argues in a genuinely different register. */
  private get voice(): string {
    return this.side === "A"
      ? "Your register: plain-spoken and numbers-first. Short sentences. No flourish, no metaphors, no slogans. State the number, state what it means, stop."
      : "Your register: vivid and people-first. Warmer. Talk about the humans at the table by name. A little color is fine, but stay concrete and cite the numbers.";
  }

  /** Phrases neither advocate may ever use. */
  private get banList(): string {
    return (
      "Never use these phrases or anything like them: " +
      "'signals do not argue back', 'the verdict writes itself'. " +
      "Never close with a slogan. Every argument must cite its evidence " +
      "(person, percentage, source)."
    );
  }

  /** Affinity scale grounding so weak numbers are never praised. */
  private get scale(): string {
    return (
      "Affinity scale: above 60% is strong, 30-60% is mixed, below 30% is " +
      "veto territory. NEVER cite a below-30% affinity as support for your " +
      "side. If your best evidence is below 30%, say the support is thin " +
      "and argue the other option is worse for the group."
    );
  }

  /**
   * Clean opponent excerpt for rebuttals: up to two sentences, ~140 chars,
   * cut only at sentence boundaries. The lookbehind split never breaks
   * inside a number ("0.27" has no space after its period), so quotes can
   * no longer end mid-number like "roughly 0".
   */
  private opponentPoint(text: string): string {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    let out = "";
    for (const s of sentences) {
      const next = out ? `${out} ${s}` : s;
      if (next.length > 140) break;
      out = next;
    }
    return out || text.slice(0, 140).trim();
  }

  /** "(Italian restaurant, $$)" for dining; "(sci-fi epic)" for movies. */
  private get descriptor(): string {
    if (this.domain === "movies") return this.candidate.cuisine;
    return `${this.candidate.cuisine}, ${this.candidate.priceTier}`;
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
          `(${this.descriptor}) as ${this.pickNoun}. ${this.voice} ` +
          `Write ONE forceful opening argument (2-3 sentences) grounded ONLY in the evidence values below (never mention JSON field names like "topLabel"). ` +
          `Cite the evidence label and its weight naturally. ${this.scale} ${this.banList} No em dashes. ` +
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
        // Paraphrase-only rebuttals: the model restates the opponent's point
        // in its own words, so a raw quote can never be pasted mid-sentence.
        const opponentSummary = opponent
          ? this.opponentPoint(opponent.text)
          : "the opposition's opening claims.";
        const prompt =
          `You are Advocate ${this.side} in the AI Courtroom, arguing FOR ${this.candidate.name} ` +
          `(${this.descriptor}). ${this.voice} ` +
          `The opposition's point, in brief: "${opponentSummary}" ` +
          `Paraphrase it in your own words; never quote it verbatim. ` +
          `Write ONE sharp rebuttal (2-3 sentences) grounded ONLY in the evidence values below (never mention JSON field names like "topLabel"). ` +
          `Cite the evidence label and weight naturally. ${this.scale} ${this.banList} No em dashes. ` +
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
