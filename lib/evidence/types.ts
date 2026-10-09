// Evidence domain types for the Disagreement Engine.
// These interfaces are the contract shared by adapters, agents, and the debate API.

export interface Person {
  id: string;
  name: string;
  seeds: string[];
}

export interface Candidate {
  id: string;
  name: string;
  cuisine: string;
  priceTier: string;
  distanceMi: number;
  rating: number;
  /** free-text descriptors for custom candidates (e.g. "Italian restaurant, family"); used for Qloo search + keyword matching */
  keywords?: string;
}

export interface Evidence {
  label: string;
  weight: number;
  detail: string;
}

export interface ScoredCandidate {
  affinity: number;
  evidence: Evidence[];
}

export interface Veto {
  person: Person;
  reason: string;
}

export interface EvidenceAdapter {
  name: string;
  resolvePerson(seeds: string[]): Promise<Person>;
  scoreCandidate(person: Person, candidate: Candidate): Promise<ScoredCandidate>;
  getVetoes(group: Person[], candidate: Candidate): Promise<Veto[]>;
}
