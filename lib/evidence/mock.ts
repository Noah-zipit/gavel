// MockQlooAdapter: hand-authored fixtures for the friends-lahore demo group.
// No raw Qloo API responses are stored anywhere in this repo (per Qloo terms).
// Deterministic. No randomness. Used when the real Qloo adapter is unavailable.

import type {
  Candidate,
  Evidence,
  EvidenceAdapter,
  Person,
  ScoredCandidate,
  Veto,
} from "./types";

const VETO_THRESHOLD = 0.3;

const PEOPLE: Person[] = [
  { id: "alex", name: "Alex", seeds: ["Hans Zimmer", "Bonobo", "Anoushka Shankar"] },
  { id: "sara", name: "Sara", seeds: ["Ariana Grande", "Billie Eilish", "Nusrat Fateh Ali Khan"] },
  { id: "jordan", name: "Jordan", seeds: ["Kendrick Lamar", "Anderson .Paak", "Talha Anjum"] },
  { id: "micah", name: "Micah", seeds: ["Coldplay", "Strings", "Taylor Swift"] },
];

export const CANDIDATES: Candidate[] = [
  {
    id: "casa-di-roma",
    name: "Casa di Roma",
    cuisine: "Italian",
    priceTier: "$$",
    distanceMi: 1.2,
    rating: 4.6,
  },
  {
    id: "sakura-sushi",
    name: "Sakura Sushi",
    cuisine: "Japanese",
    priceTier: "$$$",
    distanceMi: 2.4,
    rating: 4.4,
  },
];

interface PersonAffinity {
  personId: string;
  candidateId: string;
  affinity: number;
  evidence: Evidence[];
}

// Fixture plot: everyone leans Italian, Sara actively dislikes sushi (0.18 < 0.30 veto).
const AFFINITIES: PersonAffinity[] = [
  {
    personId: "alex",
    candidateId: "casa-di-roma",
    affinity: 0.92,
    evidence: [
      {
        label: "Alex's taste graph: 92% Italian alignment",
        weight: 0.92,
        detail:
          "Alex's seed artists (Hans Zimmer, Bonobo, Anoushka Shankar) correlate strongly with modern Italian dining: shared audience tags for jazz-adjacent listening rooms and slow-dining formats.",
      },
      {
        label: "Casa di Roma rating 4.6 from 2,100+ diners",
        weight: 0.88,
        detail:
          "The highest-rated Italian kitchen in the DHA cluster; consistent praise for handmade pasta and a calm, conversation-friendly room.",
      },
      {
        label: "1.2 mi from the group — closest candidate",
        weight: 0.81,
        detail:
          "Walking distance for most of the group. Short travel keeps the evening's energy intact.",
      },
    ],
  },
  {
    personId: "sara",
    candidateId: "casa-di-roma",
    affinity: 0.87,
    evidence: [
      {
        label: "Sara's taste graph: 87% Italian alignment",
        weight: 0.87,
        detail:
          "Sara's mix of pop and classical qawwali shares strong cross-taste links with European slow-food formats and communal table dining.",
      },
      {
        label: "Price tier $$ fits Sara's dining pattern",
        weight: 0.79,
        detail:
          "Sara's history favors mid-range restaurants over fine dining; $$ sits squarely in her comfort zone.",
      },
    ],
  },
  {
    personId: "jordan",
    candidateId: "casa-di-roma",
    affinity: 0.74,
    evidence: [
      {
        label: "Jordan's taste graph: 74% Italian alignment",
        weight: 0.74,
        detail:
          "Jordan's hip-hop and desi-pop seeds map to bold, flavor-forward cuisines; Italian's tomato-forward menu carries most of the weight.",
      },
      {
        label: "Group-night format: shared platters",
        weight: 0.68,
        detail:
          "Casa di Roma's family-style service suits a four-person night out better than a tasting-menu counter.",
      },
    ],
  },
  {
    personId: "micah",
    candidateId: "casa-di-roma",
    affinity: 0.83,
    evidence: [
      {
        label: "Micah's taste graph: 83% Italian alignment",
        weight: 0.83,
        detail:
          "Micah's pop-rock seeds correlate with crowd-pleasing comfort cuisines; Italian scores near the top of that cluster.",
      },
      {
        label: "Highest-rated candidate in the set",
        weight: 0.86,
        detail: "4.6 stars edges Sakura Sushi's 4.4 on diner ratings.",
      },
    ],
  },
  {
    personId: "alex",
    candidateId: "sakura-sushi",
    affinity: 0.71,
    evidence: [
      {
        label: "Alex's taste graph: 71% Japanese alignment",
        weight: 0.71,
        detail:
          "Alex's instrumental and world-music seeds overlap with the audiences of minimalist Japanese dining formats.",
      },
    ],
  },
  {
    personId: "sara",
    candidateId: "sakura-sushi",
    affinity: 0.18,
    evidence: [
      {
        label: "Sara's taste graph: 18% Japanese alignment",
        weight: 0.18,
        detail:
          "Sara's taste profile shows a consistent negative signal on raw-fish formats and high-formality Japanese dining; the affinity sits well below the 0.30 veto line.",
      },
      {
        label: "Sara vetoes Sakura Sushi",
        weight: 0.18,
        detail:
          "Below the veto threshold of 0.30. One veto disqualifies the candidate outright.",
      },
    ],
  },
  {
    personId: "jordan",
    candidateId: "sakura-sushi",
    affinity: 0.65,
    evidence: [
      {
        label: "Jordan's taste graph: 65% Japanese alignment",
        weight: 0.65,
        detail:
          "Jordan's hip-hop seeds carry a moderate urban-dining crossover with contemporary Japanese spots.",
      },
    ],
  },
  {
    personId: "micah",
    candidateId: "sakura-sushi",
    affinity: 0.69,
    evidence: [
      {
        label: "Micah's taste graph: 69% Japanese alignment",
        weight: 0.69,
        detail:
          "Micah's pop seeds show above-average crossover with Japanese dining audiences, though well short of Italian.",
      },
      {
        label: "$$$ price tier strains the group budget",
        weight: 0.55,
        detail:
          "The only $$$ candidate in the set; two members of the group dine mid-range by default.",
      },
    ],
  },
];

export function getDemoGroup(): Person[] {
  return PEOPLE.map((p) => ({ ...p, seeds: [...p.seeds] }));
}

export function getDemoCandidates(): Candidate[] {
  return CANDIDATES.map((c) => ({ ...c }));
}

export class MockQlooAdapter implements EvidenceAdapter {
  readonly name = "mock";

  async resolvePerson(seeds: string[]): Promise<Person> {
    const person =
      PEOPLE.find((p) => p.seeds.some((s) => seeds.includes(s))) ?? PEOPLE[0];
    return { ...person, seeds: [...person.seeds] };
  }

  async scoreCandidate(person: Person, candidate: Candidate): Promise<ScoredCandidate> {
    const hit = AFFINITIES.find(
      (a) => a.personId === person.id && a.candidateId === candidate.id
    );
    if (!hit) {
      return { affinity: 0.5, evidence: [] };
    }
    return {
      affinity: hit.affinity,
      evidence: hit.evidence.map((e) => ({ ...e })),
    };
  }

  async getVetoes(group: Person[], candidate: Candidate): Promise<Veto[]> {
    const vetoes: Veto[] = [];
    for (const person of group) {
      const scored = await this.scoreCandidate(person, candidate);
      if (scored.affinity < VETO_THRESHOLD) {
        vetoes.push({
          person,
          reason: `${person.name}'s taste affinity for ${candidate.name} is ${scored.affinity.toFixed(
            2
          )}, below the ${VETO_THRESHOLD} veto threshold. ${
            scored.evidence[0]?.detail ?? ""
          }`.trim(),
        });
      }
    }
    return vetoes;
  }
}
