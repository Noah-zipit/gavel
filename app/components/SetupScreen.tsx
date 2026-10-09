"use client";

import { useState } from "react";
import { GavelIcon } from "./icons";
import type { CustomCandidateInput, CustomPersonInput } from "@/lib/debate-setup";

export interface DebateConfig {
  people: CustomPersonInput[];
  candidates: CustomCandidateInput[];
}

const DEMO_PEOPLE: CustomPersonInput[] = [
  { name: "Alex", seeds: ["Hans Zimmer", "Bonobo", "Anoushka Shankar"] },
  { name: "Sara", seeds: ["Ariana Grande", "Billie Eilish", "Nusrat Fateh Ali Khan"] },
  { name: "Jordan", seeds: ["Kendrick Lamar", "Anderson .Paak", "Talha Anjum"] },
  { name: "Micah", seeds: ["Coldplay", "Strings", "Taylor Swift"] },
];

const DEMO_CANDIDATES: CustomCandidateInput[] = [
  { name: "Casa di Roma", keywords: "Italian restaurant, pizza, pasta", priceTier: "$$" },
  { name: "Sakura Sushi", keywords: "Japanese restaurant, sushi", priceTier: "$$$" },
];

const PRICE_TIERS = ["$", "$$", "$$$"];

interface PersonDraft {
  name: string;
  keywords: string;
}

interface CandidateDraft {
  name: string;
  keywords: string;
  priceTier: string;
}

function toConfig(
  people: PersonDraft[],
  candidates: CandidateDraft[]
): DebateConfig {
  return {
    people: people.map((p) => ({
      name: p.name.trim(),
      seeds: p.keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    })),
    candidates: candidates.map((c) => ({
      name: c.name.trim(),
      keywords: c.keywords.trim(),
      priceTier: c.priceTier,
    })),
  };
}

export default function SetupScreen({
  onStart,
}: {
  onStart: (config: DebateConfig) => void;
}) {
  const [people, setPeople] = useState<PersonDraft[]>(
    DEMO_PEOPLE.map((p) => ({ name: p.name, keywords: p.seeds.join(", ") }))
  );
  const [candidates, setCandidates] = useState<CandidateDraft[]>(
    DEMO_CANDIDATES.map((c) => ({ ...c }))
  );
  const [error, setError] = useState<string | null>(null);

  const setPerson = (i: number, patch: Partial<PersonDraft>) =>
    setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setCandidate = (i: number, patch: Partial<CandidateDraft>) =>
    setCandidates((prev) =>
      prev.map((c, j) => (j === i ? { ...c, ...patch } : c))
    );

  const start = () => {
    setError(null);
    if (people.length < 2) return setError("Add at least 2 people.");
    if (candidates.length < 2) return setError("Add at least 2 options.");
    for (const p of people) {
      if (!p.name.trim()) return setError("Every person needs a name.");
      if (!p.keywords.trim())
        return setError(`${p.name || "Someone"} needs at least one taste keyword.`);
    }
    for (const c of candidates) {
      if (!c.name.trim()) return setError("Every option needs a name.");
    }
    onStart(toConfig(people, candidates));
  };

  const inputCls =
    "w-full rounded-md border border-court-border bg-court-bg px-3 py-2.5 text-[15px] text-court-text placeholder:text-court-muted/60 focus:border-court-amber focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col bg-court-bg text-court-text">
      <header className="border-b border-court-border bg-court-panel">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-4 sm:px-6">
          <GavelIcon className="h-8 w-8 shrink-0 text-court-amber" />
          <p className="text-lg font-bold tracking-[0.18em]">
            <span className="text-court-amber">AI</span>{" "}
            <span className="text-court-muted">COURTROOM</span>
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            Set up the debate
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] text-court-muted">
            Add your people and what they like, add the options you are
            deciding between. Two advocate agents will argue it out with live
            taste-graph evidence.
          </p>
        </div>

        {/* People */}
        <section aria-label="Who is deciding">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-[0.18em] text-court-muted">
              WHO&apos;S DECIDING · {people.length}
            </h2>
            {people.length < 6 && (
              <button
                type="button"
                onClick={() =>
                  setPeople((prev) => [...prev, { name: "", keywords: "" }])
                }
                className="rounded-md border border-court-border px-3 py-1.5 text-sm font-semibold text-court-text hover:border-court-amber"
              >
                + Add person
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {people.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-court-border bg-court-panel p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    aria-label={`Person ${i + 1} name`}
                    value={p.name}
                    onChange={(e) => setPerson(i, { name: e.target.value })}
                    placeholder="Name"
                    maxLength={24}
                    className="w-full bg-transparent text-lg font-bold text-court-text placeholder:text-court-muted/50 focus:outline-none"
                  />
                  {people.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove ${p.name || `person ${i + 1}`}`}
                      onClick={() =>
                        setPeople((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="shrink-0 rounded px-2 py-1 text-sm font-bold text-court-muted hover:text-court-live"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <label className="mt-2 block text-xs font-semibold tracking-wide text-court-muted">
                  TASTE KEYWORDS
                </label>
                <input
                  aria-label={`${p.name || `Person ${i + 1}`} taste keywords`}
                  value={p.keywords}
                  onChange={(e) => setPerson(i, { keywords: e.target.value })}
                  placeholder="sushi, jazz, anime — or 'no raw fish' to veto"
                  className={`${inputCls} mt-1`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Candidates */}
        <section aria-label="Deciding between">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-[0.18em] text-court-muted">
              DECIDING BETWEEN · {candidates.length}
            </h2>
            {candidates.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  setCandidates((prev) => [
                    ...prev,
                    { name: "", keywords: "", priceTier: "$$" },
                  ])
                }
                className="rounded-md border border-court-border px-3 py-1.5 text-sm font-semibold text-court-text hover:border-court-teal"
              >
                + Add option
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {candidates.map((c, i) => {
              const accent =
                i % 2 === 0 ? "text-court-amber" : "text-court-teal";
              const border =
                i % 2 === 0 ? "focus:border-court-amber" : "focus:border-court-teal";
              return (
                <div
                  key={i}
                  className="rounded-lg border border-court-border bg-court-panel p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      aria-label={`Option ${i + 1} name`}
                      value={c.name}
                      onChange={(e) => setCandidate(i, { name: e.target.value })}
                      placeholder="Restaurant or hotel name"
                      maxLength={40}
                      className={`w-full bg-transparent text-lg font-bold ${accent} placeholder:text-court-muted/50 focus:outline-none`}
                    />
                    {candidates.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remove ${c.name || `option ${i + 1}`}`}
                        onClick={() =>
                          setCandidates((prev) =>
                            prev.filter((_, j) => j !== i)
                          )
                        }
                        className="shrink-0 rounded px-2 py-1 text-sm font-bold text-court-muted hover:text-court-live"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <label className="mt-2 block text-xs font-semibold tracking-wide text-court-muted">
                    KEYWORDS
                  </label>
                  <input
                    aria-label={`${c.name || `Option ${i + 1}`} keywords`}
                    value={c.keywords}
                    onChange={(e) =>
                      setCandidate(i, { keywords: e.target.value })
                    }
                    placeholder="Italian restaurant, pizza — or beach hotel, luxury"
                    className={`${inputCls} ${border} mt-1`}
                  />
                  <div
                    className="mt-3 flex gap-2"
                    role="radiogroup"
                    aria-label="Price tier"
                  >
                    {PRICE_TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={c.priceTier === t}
                        onClick={() => setCandidate(i, { priceTier: t })}
                        className={`min-h-[40px] flex-1 rounded-md border px-3 text-sm font-bold ${
                          c.priceTier === t
                            ? "border-court-amber bg-court-amber/15 text-court-amber"
                            : "border-court-border text-court-muted"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <p role="alert" className="text-sm font-semibold text-court-live">
            {error}
          </p>
        )}

        <div className="pb-4">
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-court-amber px-6 text-lg font-bold text-[#15171c] sm:w-auto sm:px-10"
          >
            Start the debate
          </button>
          <p className="mt-2 text-sm text-court-muted">
            Tip: add a dislike like “no sushi” to watch the judge veto it live.
          </p>
        </div>
      </main>
    </div>
  );
}
