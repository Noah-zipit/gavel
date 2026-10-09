/** Static candidate facts for the group-dining demo. */

export interface Candidate {
  id: string;
  name: string;
  side: "a" | "b";
  tags: string[];
  rating: number;
  distance: string;
  price: string;
  pros: string;
  /** match % shown before the first score event arrives */
  initialMatch: number;
}

export const CANDIDATES: Candidate[] = [
  {
    id: "casa-di-roma",
    name: "Casa di Roma",
    side: "a",
    tags: ["Italian", "Pizza", "Pasta", "Family"],
    rating: 4.6,
    distance: "1.2 mi",
    price: "$$",
    pros: "Pasta, Wine list, Booths available",
    initialMatch: 85,
  },
  {
    id: "sakura-sushi",
    name: "Sakura Sushi",
    side: "b",
    tags: ["Japanese", "Sushi", "Rolls", "Fresh"],
    rating: 4.4,
    distance: "2.4 mi",
    price: "$$$",
    pros: "Fresh fish, Quick service, Vegan options",
    initialMatch: 74,
  },
];

export function candidateById(id: string): Candidate | undefined {
  return CANDIDATES.find((c) => c.id === id);
}
