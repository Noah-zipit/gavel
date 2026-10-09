// CustomQlooAdapter: real taste-affinity scoring for user-supplied groups.
//
// WHY THIS EXISTS: /v2/insights returns empty entities for every filter.type
// in the hackathon environment (verified live 2026-10-09), so pairwise
// affinity cannot come from the insights endpoint. Instead we compute it
// deterministically from real /search entity data:
//
//   1. Each person seed (e.g. "sushi", "Ariana Grande") is resolved via
//      /search to a Qloo entity with its tag set.
//   2. Each candidate is resolved via /search to an entity with its tag set
//      and popularity (types=urn:entity:place for dining,
//      types=urn:entity:movie for movies).
//   3. Affinity = weighted blend of:
//      - keyword signal (0.60): do the person's taste keywords match the
//        candidate's keywords/place tags? Negative seeds ("no sushi",
//        "hate fish") push hard toward a veto.
//      - tag overlap (0.25): Jaccard similarity of the two Qloo tag sets.
//      - popularity (0.15): the place's Qloo popularity as a quality prior.
//   4. Clamped to [0.05, 0.95] so vetoes stay possible but never automatic.
//
// All evidence labels cite the real Qloo tags/entities used. Nothing is
// hand-authored per person; the same code scores any group.

import {
  normalizeAffinity,
  QlooUnavailableError,
  searchEntity,
  tagLabels,
  type SearchResult,
} from "./qloo";
import type {
  Candidate,
  DebateDomain,
  Evidence,
  EvidenceAdapter,
  Person,
  ScoredCandidate,
  Veto,
} from "./types";

export const CUSTOM_VETO_THRESHOLD = 0.3;

// Cuisine keyword expansion: lets "sushi" match a Japanese candidate even
// when the user only wrote the dish name, and vice versa.
const CUISINE_SYNONYMS: Record<string, string[]> = {
  italian: ["pizza", "pasta", "risotto", "lasagna", "parmesan", "gelato"],
  japanese: ["sushi", "sashimi", "ramen", "tempura", "teriyaki", "raw fish", "omakase", "fish", "nori"],
  chinese: ["dim sum", "dumpling", "noodles", "kung pao", "wonton"],
  indian: ["curry", "biryani", "tandoori", "naan", "masala", "desi"],
  mexican: ["taco", "burrito", "quesadilla", "nachos", "enchilada"],
  thai: ["pad thai", "tom yum", "satay"],
  american: ["burger", "steak", "bbq", "fries", "wings"],
  french: ["croissant", "bistro", "crepe"],
  lebanese: ["shawarma", "hummus", "falafel"],
  turkish: ["kebab", "doner", "pide"],
  korean: ["kimchi", "bibimbap", "kbbq", "bulgogi"],
  vietnamese: ["pho", "banh mi", "spring rolls"],
  seafood: ["fish", "prawn", "lobster", "oyster", "sushi", "sashimi", "raw fish", "crab"],
  vegetarian: ["vegan", "salad", "veggie"],
  dessert: ["ice cream", "cake", "chocolate", "bakery"],
  coffee: ["cafe", "espresso", "latte"],
};

const NEGATIVE_PATTERNS = [
  /^no\s+/i,
  /^not\s+/i,
  /hate/i,
  /dislike/i,
  /can't eat/i,
  /cannot eat/i,
  /allerg/i,
  /avoid/i,
];

const MOVIE_SYNONYMS: Record<string, string[]> = {
  "sci-fi": ["science fiction", "scifi", "space", "futuristic", "sci fi"],
  horror: ["scary", "thriller", "slasher", "ghost"],
  comedy: ["funny", "humor", "laugh"],
  romance: ["romantic", "love story", "love"],
  drama: ["dramatic"],
  action: ["adventure", "fight", "chase"],
  musical: ["music", "songs", "singing", "dance"],
  animation: ["animated", "anime", "cartoon"],
  fantasy: ["magic", "epic", "quest"],
  crime: ["gangster", "heist", "mafia"],
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    // Light plural normalization so "no musicals" matches a "musical" tag.
    .map((w) =>
      w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w
    );
}

function expandWithSynonyms(
  tokens: string[],
  synonyms: Record<string, string[]>
): Set<string> {
  const out = new Set(tokens);
  for (const t of tokens) {
    for (const [key, syns] of Object.entries(synonyms)) {
      if (t === key || syns.includes(t)) {
        out.add(key);
        for (const s of syns) out.add(s);
      }
    }
  }
  return out;
}

interface ResolvedSeed {
  raw: string;
  negative: boolean;
  /** negated term with the negation stripped, e.g. "no sushi" -> "sushi" */
  term: string;
  entity?: SearchResult;
}

function parseSeed(raw: string): { negative: boolean; term: string } {
  const trimmed = raw.trim();
  const negative = NEGATIVE_PATTERNS.some((p) => p.test(trimmed));
  const term = negative
    ? trimmed
        .replace(/^no\s+/i, "")
        .replace(/^not\s+/i, "")
        .replace(/^(i\s+)?(hate|dislike|avoid)\s+/i, "")
        .trim() || trimmed
    : trimmed;
  return { negative, term };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface CustomPerson extends Person {
  resolvedSeeds: ResolvedSeed[];
}

export interface CustomCandidate extends Candidate {
  placeEntity?: SearchResult;
  placeTags: string[];
}

async function resolveSeed(raw: string): Promise<ResolvedSeed> {
  const { negative, term } = parseSeed(raw);
  let entity: SearchResult | undefined;
  try {
    entity = (await searchEntity(term)) ?? undefined;
  } catch {
    // Search failure for one seed must not kill the debate; the raw term
    // still participates in keyword matching.
    entity = undefined;
  }
  return { raw, negative, term, entity };
}

export class CustomQlooAdapter implements EvidenceAdapter {
  readonly name = "custom-qloo";
  private readonly domain: DebateDomain;
  private readonly entityType: string;
  /** "place" for dining, "movie" for movies; used in evidence copy. */
  private readonly entityNoun: string;
  private readonly synonyms: Record<string, string[]>;

  constructor(domain: DebateDomain = "dining") {
    this.domain = domain;
    this.entityType = domain === "movies" ? "urn:entity:movie" : "urn:entity:place";
    this.entityNoun = domain === "movies" ? "movie" : "place";
    this.synonyms = domain === "movies" ? MOVIE_SYNONYMS : CUISINE_SYNONYMS;
  }

  async resolvePerson(seeds: string[]): Promise<CustomPerson> {
    const resolvedSeeds = await Promise.all(seeds.map(resolveSeed));
    const name = seeds[0]?.trim() || "Guest";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24);
    return {
      id: `custom-${slug || "guest"}-${Date.now().toString(36)}`,
      name,
      seeds,
      resolvedSeeds,
    };
  }

  private async resolveCandidateEntity(
    candidate: Candidate
  ): Promise<{ entity?: SearchResult; tags: string[] }> {
    // Prefer name + keywords for the lookup; fall back to name alone.
    const keywords = (candidate as CustomCandidate).keywords ?? "";
    const queries = [
      `${candidate.name} ${keywords}`.trim(),
      candidate.name,
    ];
    for (const qstr of queries) {
      try {
        const hit = await searchEntity(qstr, this.entityType);
        if (hit?.entity_id) {
          return { entity: hit, tags: tagLabels(hit.tags) };
        }
      } catch {
        // try next query
      }
    }
    return { entity: undefined, tags: [] };
  }

  private scoreAffinity(
    person: CustomPerson,
    candidate: Candidate,
    entityTags: string[],
    popularity: number
  ): { affinity: number; pos: number; neg: number; overlap: number } {
    // Candidate keyword universe: name + keywords + Qloo entity tags, expanded.
    const keywords = (candidate as CustomCandidate).keywords ?? "";
    const candTokens = expandWithSynonyms(
      tokenize(`${candidate.name} ${keywords} ${entityTags.join(" ")}`),
      this.synonyms
    );

    let pos = 0;
    let neg = 0;
    const personTagSet = new Set<string>();
    for (const seed of person.resolvedSeeds) {
      const seedTokens = expandWithSynonyms(tokenize(seed.term), this.synonyms);
      for (const t of seed.entity ? tagLabels(seed.entity.tags) : []) {
        for (const tok of tokenize(t)) personTagSet.add(tok);
      }
      const hit = [...seedTokens].some((t) => candTokens.has(t));
      if (hit) {
        if (seed.negative) neg++;
        else pos++;
      }
    }

    const entityTagSet = new Set<string>();
    for (const t of entityTags) for (const tok of tokenize(t)) entityTagSet.add(tok);
    const overlap = jaccard(personTagSet, entityTagSet);

    const keywordScore = Math.min(
      0.95,
      Math.max(0.05, 0.5 + 0.12 * pos - 0.45 * neg)
    );
    const tagScore = Math.min(1, 0.4 + overlap * 2);
    const popScore = normalizeAffinity(popularity);

    const affinity = Math.min(
      0.95,
      Math.max(
        0.05,
        0.6 * keywordScore + 0.25 * tagScore + 0.15 * popScore
      )
    );
    return { affinity, pos, neg, overlap };
  }

  async scoreCandidate(
    person: Person,
    candidate: Candidate
  ): Promise<ScoredCandidate> {
    const cp = person as CustomPerson;
    if (!cp.resolvedSeeds) {
      throw new QlooUnavailableError("person was not resolved via CustomQlooAdapter");
    }
    // Entity resolution can flake under parallel load; retry once before
    // giving up. If Qloo truly has no entity for this candidate, score from
    // the user's own keywords (still real signal, no mock data).
    let place: { entity: SearchResult | null; tags: string[] } = {
      entity: null,
      tags: [],
    };
    for (let attempt = 0; attempt < 2 && !place.entity?.entity_id; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
      try {
        const resolved = await this.resolveCandidateEntity(candidate);
        place = { entity: resolved.entity ?? null, tags: resolved.tags };
      } catch {
        // try again or fall through to keyword-only scoring
      }
    }
    const entity = place.entity;
    const tags = place.tags;
    const noun = this.entityNoun;

    const { affinity, pos, neg, overlap } = this.scoreAffinity(
      cp,
      candidate,
      tags,
      entity?.popularity ?? 50
    );

    const placeNote = entity
      ? `Qloo entity matching: ${pos} taste keyword${pos === 1 ? "" : "s"} overlap${neg > 0 ? `, ${neg} dislike${neg === 1 ? "" : "s"} flagged` : ""} against ${candidate.name}'s Qloo ${noun} tags${tags.length ? ` (${tags.slice(0, 4).join(", ")})` : ""}.`
      : `Keyword matching against ${candidate.name} (${pos} taste keyword${pos === 1 ? "" : "s"} overlap${neg > 0 ? `, ${neg} dislike${neg === 1 ? "" : "s"} flagged` : ""}); Qloo had no ${noun} entity for this name, so ${noun} tags were unavailable.`;

    const evidence: Evidence[] = [
      {
        label: `${person.name}'s taste graph: ${Math.round(affinity * 100)}% alignment`,
        weight: affinity,
        detail:
          pos > 0 || neg > 0
            ? placeNote
            : `Qloo ${noun} tags for ${candidate.name}${tags.length ? ` (${tags.slice(0, 4).join(", ")})` : ""}; no direct keyword overlap with ${person.name}'s taste seeds, scored from tag similarity and ${noun} popularity.`,
      },
    ];
    if (overlap > 0.02) {
      evidence.push({
        label: `Shared taste tags: ${Math.round(overlap * 100)}% overlap`,
        weight: Math.min(1, 0.4 + overlap * 2),
        detail: `Qloo tag overlap between ${person.name}'s seed entities and ${candidate.name}.`,
      });
    }

    return { affinity, evidence };
  }

  async getVetoes(group: Person[], candidate: Candidate): Promise<Veto[]> {
    const vetoes: Veto[] = [];
    for (const person of group) {
      const scored = await this.scoreCandidate(person, candidate);
      if (scored.affinity < CUSTOM_VETO_THRESHOLD) {
        vetoes.push({
          person,
          reason: `${person.name}'s taste affinity for ${candidate.name} is ${scored.affinity.toFixed(
            2
          )}, below the ${CUSTOM_VETO_THRESHOLD} veto threshold. ${
            scored.evidence[0]?.detail ?? ""
          }`.trim(),
        });
      }
    }
    return vetoes;
  }
}
