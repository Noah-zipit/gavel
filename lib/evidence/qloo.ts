// RealQlooAdapter: live adapter against the Qloo Agentic Hackathon API.
// Base URL from QLOO_BASE_URL (default https://hackathon.api.qloo.com).
// Auth is the X-Api-Key header ONLY. No key material is ever logged, stored,
// or included in error messages; the key is read from process.env at request time.
//
// Qloo quirks handled here (from the official hackathon docs):
//  - Invalid params are SILENTLY IGNORED: a 200 with an empty entities array is
//    always a soft failure, never trusted as a zero-affinity signal.
//  - Hackathon keys ONLY work on hackathon.api.qloo.com (401 elsewhere).
//  - /v2/insights is GET-only; all parameters ride the query string.
//  - Food places use filter.type=urn:entity:place (urn:entity:food_and_drink 403s).
//  - Server-side caching is allowed: in-memory TTL cache (10 min), keyed by URL.

import type {
  Candidate,
  EvidenceAdapter,
  Evidence,
  Person,
  ScoredCandidate,
  Veto,
} from "./types";

export const QLOO_VETO_THRESHOLD = 0.3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";

export class QlooUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QlooUnavailableError";
  }
}

export interface SearchResult {
  name?: string;
  entity_id?: string;
  types?: string[];
  popularity?: number;
  tags?: Array<{ name?: string; id?: string }>;
}

interface SearchResponse {
  results?: SearchResult[];
  success?: boolean;
}

interface InsightsResponse {
  success?: boolean;
  entities?: Array<{
    name?: string;
    entity_id?: string;
    popularity?: number;
    affinity?: number;
    score?: number;
    tags?: Array<{ name?: string; id?: string }>;
  }>;
}

const cache = new Map<string, { expires: number; value: string }>();

function baseUrl(): string {
  const raw = (process.env.QLOO_BASE_URL ?? "").trim();
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function warn(message: string): void {
  console.warn(`[qloo] ${message}`);
}

async function fetchWithTimeout(url: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function readKey(): string {
  const key = (process.env.QLOO_API_KEY ?? "").trim();
  if (!key) {
    throw new QlooUnavailableError("QLOO_API_KEY is not set");
  }
  return key;
}

// Cached GET returning parsed JSON. Throws QlooUnavailableError on any failure.
async function cachedGetJson<T>(url: string): Promise<T> {
  const apiKey = readKey();
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    return JSON.parse(cached.value) as T;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(url, apiKey);
  } catch (err) {
    warn(`request failed (network/timeout): ${err instanceof Error ? err.message : "unknown"}`);
    throw new QlooUnavailableError("Qloo request failed");
  }

  if (res.status === 401) {
    warn("401 unauthorized — key may be invalid or used against the wrong host");
    throw new QlooUnavailableError("Qloo unauthorized");
  }
  if (res.status === 429) {
    warn("429 rate limited by Qloo");
    throw new QlooUnavailableError("Qloo rate limited");
  }
  if (!res.ok) {
    warn(`unexpected status ${res.status}`);
    throw new QlooUnavailableError(`Qloo returned status ${res.status}`);
  }

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    warn("response was not valid JSON");
    throw new QlooUnavailableError("Qloo returned invalid JSON");
  }

  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, value: JSON.stringify(data) });
  return data;
}

function q(url: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  return `${url}?${qs.toString()}`;
}

export async function searchEntity(
  query: string,
  typeFilter?: string
): Promise<SearchResult | null> {
  const url = q(`${baseUrl()}/search`, { query, ...(typeFilter ? { types: typeFilter } : {}) });
  const data = await cachedGetJson<SearchResponse>(url);
  const results = data.results ?? [];
  if (results.length === 0) {
    // Quirk (a): invalid params are silently ignored -> 200 with empty results.
    warn(`search returned no results for query (soft failure)`);
    return null;
  }
  return results[0] ?? null;
}

// Payment/amenity junk that Qloo attaches to place entities ("Mastercard",
// "Accepts credit cards", "Convenient", "Parking", ...). These are not taste
// signal and must never reach argument prose, evidence labels, or the UI.
const JUNK_TAG_PATTERNS = [
  /mastercard/i,
  /\bvisa\b/i,
  /\bamex\b/i,
  /credit card/i,
  /\bconvenient\b/i,
  /convenience/i,
  /^place$/i,
  /parking/i,
  /\bwifi\b/i,
  /restroom/i,
  /\batm\b/i,
];

export function tagLabels(tags: Array<{ name?: string; id?: string }> | undefined): string[] {
  return (tags ?? [])
    .map((t) => t.name ?? "")
    .filter(Boolean)
    .filter((name) => !JUNK_TAG_PATTERNS.some((p) => p.test(name)))
    .slice(0, 6);
}

export function normalizeAffinity(raw: unknown): number {
  let n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0.5;
  // Qloo sometimes returns 0..100 affinity; normalize to 0..1.
  if (n > 1) n = n / 100;
  return Math.min(1, Math.max(0, n));
}

export class RealQlooAdapter implements EvidenceAdapter {
  readonly name = "real-qloo";

  async resolvePerson(seeds: string[]): Promise<Person> {
    const resolved: string[] = [];
    for (const seed of seeds) {
      try {
        const hit = await searchEntity(seed);
        if (hit?.entity_id) {
          resolved.push(`${seed} [${hit.entity_id}]`);
        } else {
          resolved.push(seed);
        }
      } catch (err) {
        if (err instanceof QlooUnavailableError) throw err;
        warn("resolvePerson seed lookup failed; keeping raw seed");
        resolved.push(seed);
      }
    }
    return { id: `person-${Date.now().toString(36)}`, name: seeds[0] ?? "Guest", seeds: resolved };
  }

  async scoreCandidate(person: Person, candidate: Candidate): Promise<ScoredCandidate> {
    // Step 1: resolve the restaurant to a place entity.
    const place = await searchEntity(candidate.name, "urn:entity:place");
    if (!place?.entity_id) {
      warn(`could not resolve place entity for candidate; soft failure`);
      throw new QlooUnavailableError("place entity not found");
    }

    // Step 2: affinity of the person's seed artists against places.
    // The insights endpoint is a ranked-recommendations endpoint, not a pairwise
    // scorer, so we pull a ranked batch and look for our candidate's entity id.
    // NOTE: food places must use filter.type=urn:entity:place (food_and_drink 403s).
    const artistIds = person.seeds
      .map((s) => {
        const m = s.match(/\[([^\]]+)\]$/);
        return m?.[1] ?? null;
      })
      .filter((x): x is string => Boolean(x));

    const insightsUrl = q(`${baseUrl()}/v2/insights`, {
      "filter.type": "urn:entity:place",
      "signal.interests.entities":
        artistIds.length > 0 ? artistIds.join(",") : place.entity_id,
      "filter.location.query": candidate.name,
      take: "50",
    });

    const data = await cachedGetJson<InsightsResponse>(insightsUrl);
    const entities = data.entities ?? [];
    if (entities.length === 0) {
      warn("insights returned empty entities (params silently ignored or no signal)");
      throw new QlooUnavailableError("insights returned no entities");
    }

    const matched =
      entities.find((e) => e.entity_id === place.entity_id) ?? null;
    if (!matched) {
      warn("candidate place not present in insights batch; soft failure");
      throw new QlooUnavailableError("candidate not in insights results");
    }

    const rawAffinity =
      matched.affinity ?? matched.score ?? (matched.popularity ?? 50) / 100;
    const affinity = normalizeAffinity(rawAffinity);

    const tags = tagLabels(matched.tags);
    const evidence: Evidence[] = [
      {
        label: `${person.name}'s taste graph: ${Math.round(affinity * 100)}% alignment`,
        weight: affinity,
        detail: tags.length
          ? `Qloo taste-graph overlap for ${candidate.name} via the seed artist graph; shared tags: ${tags.join(", ")}.`
          : `Qloo taste-graph overlap for ${candidate.name} via the seed artist graph.`,
      },
      {
        label: `${candidate.name} popularity signal: ${Math.round(
          (matched.popularity ?? 0) * 100
        ) / 100}`,
        weight: normalizeAffinity((matched.popularity ?? 50) / 100),
        detail: `Qloo popularity for the ${candidate.cuisine} place entity, normalized to 0..1.`,
      },
    ];
    return { affinity, evidence };
  }

  async getVetoes(group: Person[], candidate: Candidate): Promise<Veto[]> {
    // scoreCandidate throws QlooUnavailableError on any failure (quirk e), which
    // propagates to the caller so it can fall back to the mock adapter.
    const vetoes: Veto[] = [];
    for (const person of group) {
      const scored = await this.scoreCandidate(person, candidate);
      if (scored.affinity < QLOO_VETO_THRESHOLD) {
        vetoes.push({
          person,
          reason: `${person.name}'s taste affinity for ${candidate.name} is ${scored.affinity.toFixed(
            2
          )}, below the ${QLOO_VETO_THRESHOLD} veto threshold. ${
            scored.evidence[0]?.detail ?? ""
          }`.trim(),
        });
      }
    }
    return vetoes;
  }
}
