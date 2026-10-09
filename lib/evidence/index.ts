// Evidence adapter selection.
//
// getAdapter(): RealQlooAdapter when QLOO_ADAPTER !== "mock" AND QLOO_API_KEY is
// set; otherwise MockQlooAdapter. The key itself is never logged or exposed.
//
// withFallback(): wraps the real adapter so any QlooUnavailableError switches
// the remainder of the debate to mock. The debate must always run, even with
// no key, no network, or a misbehaving API.

import type { Candidate, EvidenceAdapter, Person } from "./types";
import { MockQlooAdapter } from "./mock";
import { QlooUnavailableError, RealQlooAdapter } from "./qloo";

export function isRealQlooConfigured(): boolean {
  return (
    (process.env.QLOO_ADAPTER ?? "").toLowerCase() !== "mock" &&
    Boolean((process.env.QLOO_API_KEY ?? "").trim())
  );
}

export function getAdapter(): EvidenceAdapter {
  if (isRealQlooConfigured()) {
    console.log("evidence: real-qloo");
    return new RealQlooAdapter();
  }
  console.log("evidence: mock");
  return new MockQlooAdapter();
}

// Proxies an EvidenceAdapter, switching permanently to mock on the first
// QlooUnavailableError. Non-mock adapters pass through untouched.
export function withFallback(adapter: EvidenceAdapter): EvidenceAdapter {
  if (!(adapter instanceof RealQlooAdapter)) {
    return adapter;
  }
  const mock = new MockQlooAdapter();
  let degraded = false;

  const wrap = <Args extends unknown[], R>(
    real: (...args: Args) => Promise<R>,
    fake: (...args: Args) => Promise<R>
  ) =>
    async (...args: Args): Promise<R> => {
      if (degraded) {
        return fake(...args);
      }
      try {
        return await real(...args);
      } catch (err) {
        if (err instanceof QlooUnavailableError) {
          degraded = true;
          // No key material is logged here.
          console.warn("evidence: real-qloo unavailable; falling back to mock");
          return fake(...args);
        }
        throw err;
      }
    };

  return {
    name: "real-qloo (with mock fallback)",
    resolvePerson: wrap(
      (seeds: string[]) => adapter.resolvePerson(seeds),
      (seeds: string[]) => mock.resolvePerson(seeds)
    ),
    scoreCandidate: wrap(
      (person: Person, candidate: Candidate) => adapter.scoreCandidate(person, candidate),
      (person: Person, candidate: Candidate) => mock.scoreCandidate(person, candidate)
    ),
    getVetoes: wrap(
      (group: Person[], candidate: Candidate) => adapter.getVetoes(group, candidate),
      (group: Person[], candidate: Candidate) => mock.getVetoes(group, candidate)
    ),
  };
}
