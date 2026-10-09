/**
 * SSE event contract for the AI Courtroom debate stream.
 *
 * The server sends one JSON object per SSE message with a `type` field.
 * This module is the single source of truth for those shapes; both the
 * client (this app) and the API route (owned by another agent) must agree
 * on it.
 */

export type DebateSide = "a" | "b";

/**
 * Raw side value as sent by the API. The debate route sends "A"/"B";
 * the parser normalizes to lowercase DebateSide.
 */
export type RawDebateSide = "A" | "B" | "a" | "b";

/**
 * Raw round value as sent by the API. The debate route sends the phase
 * name ("opening" | "rebuttal"); numeric rounds are also accepted.
 */
export type RawRound = string | number;

export interface ArgumentEvidence {
  /** e.g. "Sara's taste graph" */
  label: string;
  /** 0-100 */
  weight: number;
  /** optional supporting detail, e.g. "14 Italian check-ins in 60 days" */
  detail?: string;
}

export interface ArgumentEvent {
  type: "argument";
  round: RawRound;
  side: DebateSide;
  text: string;
  evidence: ArgumentEvidence;
}

export interface ScoreEvent {
  type: "score";
  /** 0-100 lean for Advocate A (Casa di Roma) */
  a: number;
  /** 0-100 lean for Advocate B (Sakura Sushi) */
  b: number;
  /** signed swing: positive favors A, negative favors B */
  delta: number;
  /** human-readable reason, e.g. "Sara's graph pushed Italian +6" */
  reason: string;
}

export interface EvidenceEvent {
  type: "evidence";
  /** board node id, e.g. "sara-italian" */
  nodeId: string;
  /** true = light the node up, false = dim it */
  lit: boolean;
}

export interface VetoEvent {
  type: "veto";
  /** candidate id, e.g. "sakura-sushi" */
  candidateId: string;
  /** who issued the veto, e.g. "Judge" or "Sara's taste graph" */
  by: string;
  reason: string;
}

export interface ProofStep {
  step: string;
  evidence: string;
  /** 0-100 */
  weight: number;
}

export interface VerdictEvent {
  type: "verdict";
  winnerId: string;
  loserId: string;
  proofChain: ProofStep[];
  summary: string;
}

export interface DoneEvent {
  type: "done";
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type DebateEvent =
  | ArgumentEvent
  | ScoreEvent
  | EvidenceEvent
  | VetoEvent
  | VerdictEvent
  | DoneEvent
  | ErrorEvent;

const EVENT_TYPES = new Set([
  "argument",
  "score",
  "evidence",
  "veto",
  "verdict",
  "done",
  "error",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Parse one SSE payload into a typed DebateEvent.
 * Returns null when the payload is not a well-formed debate event,
 * so the stream consumer can skip it without crashing.
 */
export function parseDebateEvent(raw: string): DebateEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.type !== "string") return null;
  if (!EVENT_TYPES.has(data.type)) return null;

  switch (data.type) {
    case "argument": {
      const rawSide = data.side;
      const side: DebateSide | null =
        rawSide === "A" || rawSide === "a"
          ? "a"
          : rawSide === "B" || rawSide === "b"
            ? "b"
            : null;
      if (
        side === null ||
        (typeof data.round !== "string" && !isNumber(data.round)) ||
        typeof data.text !== "string" ||
        !isRecord(data.evidence) ||
        typeof data.evidence.label !== "string" ||
        !isNumber(data.evidence.weight)
      ) {
        return null;
      }
      const evidence: ArgumentEvidence = {
        label: data.evidence.label,
        weight: data.evidence.weight,
        detail:
          typeof data.evidence.detail === "string"
            ? data.evidence.detail
            : undefined,
      };
      return {
        type: "argument",
        round: data.round,
        side,
        text: data.text,
        evidence,
      };
    }
    case "score": {
      if (
        !isNumber(data.a) ||
        !isNumber(data.b) ||
        !isNumber(data.delta) ||
        typeof data.reason !== "string"
      ) {
        return null;
      }
      return {
        type: "score",
        a: data.a,
        b: data.b,
        delta: data.delta,
        reason: data.reason,
      };
    }
    case "evidence": {
      if (typeof data.nodeId !== "string" || typeof data.lit !== "boolean") {
        return null;
      }
      return { type: "evidence", nodeId: data.nodeId, lit: data.lit };
    }
    case "veto": {
      if (
        typeof data.candidateId !== "string" ||
        typeof data.by !== "string" ||
        typeof data.reason !== "string"
      ) {
        return null;
      }
      return {
        type: "veto",
        candidateId: data.candidateId,
        by: data.by,
        reason: data.reason,
      };
    }
    case "verdict": {
      if (
        typeof data.winnerId !== "string" ||
        typeof data.loserId !== "string" ||
        !Array.isArray(data.proofChain) ||
        typeof data.summary !== "string"
      ) {
        return null;
      }
      const proofChain: ProofStep[] = [];
      for (const s of data.proofChain) {
        if (
          !isRecord(s) ||
          typeof s.step !== "string" ||
          typeof s.evidence !== "string" ||
          !isNumber(s.weight)
        ) {
          return null;
        }
        proofChain.push({ step: s.step, evidence: s.evidence, weight: s.weight });
      }
      return {
        type: "verdict",
        winnerId: data.winnerId,
        loserId: data.loserId,
        proofChain,
        summary: data.summary,
      };
    }
    case "done":
      return { type: "done" };
    case "error":
      return typeof data.message === "string"
        ? { type: "error", message: data.message }
        : null;
    default:
      return null;
  }
}

/**
 * Evidence weights arrive on a 0-1 scale (e.g. 0.92) from the debate
 * route; some sources use 0-100. Normalize to a 0-100 percentage for
 * display.
 */
export function weightToPct(weight: number): number {
  const pct = weight <= 1 ? weight * 100 : weight;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/**
 * Display form for a proof-chain weight. 0-1 scale weights become
 * percentages; larger values (e.g. summed affinity scores) are shown
 * as raw scores rather than mislabeled percentages.
 */
export function formatWeight(weight: number): string {
  if (weight <= 1) return `${weightToPct(weight)}%`;
  return `${Math.round(weight * 100) / 100}`;
}

/** Human label for a raw round value: "opening" -> "Opening", 2 -> "Round 2". */
export function roundLabel(round: RawRound): string {
  if (typeof round === "number") return `Round ${round}`;
  const s = round.trim();
  if (!s) return "Round";
  if (/^\d+$/.test(s)) return `Round ${s}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
