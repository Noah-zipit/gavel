/** Candidate display facts for the courtroom cards. Built dynamically per debate. */

import type { DebateDomain } from "@/lib/evidence/types";

export interface DisplayCandidate {
  id: string;
  name: string;
  side: "a" | "b";
  tags: string[];
  price: string;
  rating?: number;
  distance?: string;
  pros?: string;
  domain: DebateDomain;
  /** match % shown before the first score event arrives */
  initialMatch: number;
}

/** Build card data from the debate config (pre-debate) or API (live). */
export function buildDisplayCandidates(
  candidates: Array<{
    id?: string;
    name: string;
    keywords?: string;
    priceTier?: string;
    side?: string;
  }>,
  domain: DebateDomain = "dining"
): DisplayCandidate[] {
  return candidates.map((c, i) => ({
    id: c.id ?? `candidate-${i}`,
    name: c.name,
    side: (c.side === "b" || i === 1 ? "b" : "a") as "a" | "b",
    tags: (c.keywords ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4),
    price: c.priceTier ?? "",
    domain,
    initialMatch: 50,
  }));
}
