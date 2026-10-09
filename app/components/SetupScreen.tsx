"use client";

import { useEffect, useState } from "react";
import { GavelIcon } from "./icons";
import type { CustomCandidateInput, CustomPersonInput } from "@/lib/debate-setup";
import type { DebateDomain } from "@/lib/evidence/types";
import { loadHistory, type HistoryEntry } from "@/lib/history";

export interface DebateConfig {
  domain: DebateDomain;
  people: CustomPersonInput[];
  candidates: CustomCandidateInput[];
}

const DEMO_PEOPLE_DINING: CustomPersonInput[] = [
  { name: "Alex", seeds: ["Hans Zimmer", "Bonobo", "Anoushka Shankar"] },
  { name: "Sara", seeds: ["Ariana Grande", "Billie Eilish", "Nusrat Fateh Ali Khan"] },
  { name: "Jordan", seeds: ["Kendrick Lamar", "Anderson .Paak", "Talha Anjum"] },
  { name: "Micah", seeds: ["Coldplay", "Strings", "Taylor Swift"] },
];

const DEMO_CANDIDATES_DINING: CustomCandidateInput[] = [
  { name: "Casa di Roma", keywords: "Italian restaurant, pizza, pasta", priceTier: "$$" },
  { name: "Sakura Sushi", keywords: "Japanese restaurant, sushi", priceTier: "$$$" },
];

const DEMO_PEOPLE_MOVIES: CustomPersonInput[] = [
  { name: "Alex", seeds: ["Dune", "Blade Runner 2049", "Interstellar"] },
  { name: "Sara", seeds: ["La La Land", "The Greatest Showman", "Mamma Mia"] },
  { name: "Jordan", seeds: ["The Dark Knight", "Inception", "no musicals"] },
  { name: "Micah", seeds: ["Spider-Man", "Avengers: Endgame", "The Batman"] },
];

const DEMO_CANDIDATES_MOVIES: CustomCandidateInput[] = [
  { name: "Dune: Part Two", keywords: "sci-fi epic, desert adventure", priceTier: "" },
  { name: "La La Land", keywords: "musical romance, Los Angeles", priceTier: "" },
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

function draftsFor(domain: DebateDomain): {
  people: PersonDraft[];
  candidates: CandidateDraft[];
} {
  const dp = domain === "movies" ? DEMO_PEOPLE_MOVIES : DEMO_PEOPLE_DINING;
  const dc = domain === "movies" ? DEMO_CANDIDATES_MOVIES : DEMO_CANDIDATES_DINING;
  return {
    people: dp.map((p) => ({ name: p.name, keywords: p.seeds.join(", ") })),
    candidates: dc.map((c) => ({ ...c })),
  };
}

function toConfig(
  domain: DebateDomain,
  people: PersonDraft[],
  candidates: CandidateDraft[]
): DebateConfig {
  return {
    domain,
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
      priceTier: domain === "movies" ? "" : c.priceTier,
    })),
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function HistorySection() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  if (entries.length === 0) return null;

  return (
    <section aria-label="Past verdicts" className="mt-10 sm:mt-12">
      <h2 className="eyebrow text-court-muted">
        Past verdicts · {entries.length}
      </h2>
      <ul className="mt-4 flex flex-col gap-2">
        {entries.map((e) => {
          const open = openId === e.id;
          return (
            <li
              key={e.id}
              className="rounded-lg border border-court-border bg-court-panel"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.id)}
                aria-expanded={open}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-sm font-bold text-court-gold">
                  {e.winner}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-court-subtle">
                  {e.domain}
                </span>
                <span className="ml-auto shrink-0 text-xs text-court-subtle">
                  {formatDate(e.date)}
                </span>
              </button>
              {open && (
                <div className="border-t border-court-border px-4 py-3">
                  <p className="text-sm font-medium text-court-text">
                    {e.summary}
                  </p>
                  {e.veto && (
                    <p className="mt-2 text-sm text-court-muted">
                      Veto: {e.veto.by} blocked {e.veto.candidate}.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-court-subtle">
                    {e.people.join(", ")} decided between{" "}
                    {e.candidates.join(" and ")}.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function SetupScreen({
  onStart,
}: {
  onStart: (config: DebateConfig) => void;
}) {
  const [domain, setDomain] = useState<DebateDomain>("dining");
  const initial = draftsFor("dining");
  const [people, setPeople] = useState<PersonDraft[]>(initial.people);
  const [candidates, setCandidates] = useState<CandidateDraft[]>(
    initial.candidates
  );
  const [error, setError] = useState<string | null>(null);

  const switchDomain = (d: DebateDomain) => {
    if (d === domain) return;
    setDomain(d);
    const fresh = draftsFor(d);
    setPeople(fresh.people);
    setCandidates(fresh.candidates);
    setError(null);
  };

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
    onStart(toConfig(domain, people, candidates));
  };

  const fieldCls =
    "mt-2 min-h-[44px] w-full rounded-md border border-court-border bg-court-bg px-3 py-2.5 text-[15px] text-court-text placeholder:text-court-subtle focus:border-court-border-strong focus:outline-none";

  const isMovies = domain === "movies";

  return (
    <div className="flex min-h-screen flex-col bg-court-bg text-court-text">
      <header className="border-b border-court-border">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-4 sm:px-6">
          <GavelIcon className="h-7 w-7 shrink-0 text-court-amber" />
          <p className="text-base font-bold tracking-[0.14em]">
            <span className="text-court-amber">AI</span>{" "}
            <span className="text-court-muted">COURTROOM</span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="eyebrow text-court-amber">The Disagreement Engine</p>
          <h1 className="display-tight mt-3 text-4xl font-bold text-court-text sm:text-5xl">
            Settle the group chat.
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-court-muted">
            {isMovies
              ? "Two advocate agents argue your movie options with live taste evidence. The judge vetoes what the group cannot stand, then delivers a verdict with receipts."
              : "Two advocate agents argue your options with live taste evidence. The judge vetoes what the group cannot stand, then delivers a verdict with receipts."}
          </p>
        </div>

        {/* Domain toggle */}
        <div className="mt-8 max-w-2xl">
          <div
            className="grid grid-cols-2 gap-1 rounded-md border border-court-border bg-court-panel p-1"
            role="radiogroup"
            aria-label="What are you deciding"
          >
            {(["dining", "movies"] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={domain === d}
                onClick={() => switchDomain(d)}
                className={`inline-flex min-h-[44px] items-center justify-center rounded px-4 text-sm font-bold uppercase tracking-[0.14em] ${
                  domain === d
                    ? "bg-court-surface3 text-court-text"
                    : "text-court-subtle hover:text-court-muted"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* People */}
        <section aria-label="Who is deciding" className="mt-10 sm:mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow text-court-muted">
              Who&apos;s deciding · {people.length}
            </h2>
            {people.length < 6 && (
              <button
                type="button"
                onClick={() =>
                  setPeople((prev) => [...prev, { name: "", keywords: "" }])
                }
                className="inline-flex min-h-[44px] items-center rounded-md border border-court-border bg-court-panel px-4 text-sm font-semibold text-court-text hover:border-court-border-strong"
              >
                + Add person
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {people.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-court-border bg-court-panel p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    aria-label={`Person ${i + 1} name`}
                    value={p.name}
                    onChange={(e) => setPerson(i, { name: e.target.value })}
                    placeholder="Name"
                    maxLength={24}
                    className="display-tight w-full bg-transparent text-lg font-bold text-court-text placeholder:text-court-subtle focus:outline-none"
                  />
                  {people.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove ${p.name || `person ${i + 1}`}`}
                      onClick={() =>
                        setPeople((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-sm font-bold text-court-subtle hover:text-court-live"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <label className="eyebrow mt-3 block text-court-subtle">
                  Taste keywords
                </label>
                <input
                  aria-label={`${p.name || `Person ${i + 1}`} taste keywords`}
                  value={p.keywords}
                  onChange={(e) => setPerson(i, { keywords: e.target.value })}
                  placeholder={
                    isMovies
                      ? "Dune, horror, or 'no musicals' to veto"
                      : "sushi, jazz, anime, or 'no raw fish' to veto"
                  }
                  className={fieldCls}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Candidates */}
        <section aria-label="Deciding between" className="mt-10 sm:mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow text-court-muted">
              Deciding between · {candidates.length}
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
                className="inline-flex min-h-[44px] items-center rounded-md border border-court-border bg-court-panel px-4 text-sm font-semibold text-court-text hover:border-court-border-strong"
              >
                + Add option
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {candidates.map((c, i) => {
              const accent =
                i % 2 === 0 ? "text-court-amber" : "text-court-teal";
              return (
                <div
                  key={i}
                  className="rounded-lg border border-court-border bg-court-panel p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      aria-label={`Option ${i + 1} name`}
                      value={c.name}
                      onChange={(e) => setCandidate(i, { name: e.target.value })}
                      placeholder={
                        isMovies ? "Movie title" : "Restaurant or hotel name"
                      }
                      maxLength={40}
                      className={`display-tight w-full bg-transparent text-lg font-bold ${accent} placeholder:text-court-subtle focus:outline-none`}
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
                        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-sm font-bold text-court-subtle hover:text-court-live"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <label className="eyebrow mt-3 block text-court-subtle">
                    Keywords
                  </label>
                  <input
                    aria-label={`${c.name || `Option ${i + 1}`} keywords`}
                    value={c.keywords}
                    onChange={(e) =>
                      setCandidate(i, { keywords: e.target.value })
                    }
                    placeholder={
                      isMovies
                        ? "sci-fi epic, space adventure"
                        : "Italian restaurant, pizza, or beach hotel, luxury"
                    }
                    className={fieldCls}
                  />
                  {!isMovies && (
                    <div
                      className="mt-3 grid grid-cols-3 gap-1 rounded-md border border-court-border bg-court-bg p-1"
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
                          className={`inline-flex min-h-[44px] items-center justify-center rounded px-3 text-sm font-bold ${
                            c.priceTier === t
                              ? "bg-court-surface3 text-court-text"
                              : "text-court-subtle hover:text-court-muted"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <p role="alert" className="mt-6 text-sm font-semibold text-court-live">
            {error}
          </p>
        )}

        {/* Start */}
        <div className="mt-10 border-t border-court-border pt-6 sm:mt-12">
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-court-amber px-8 text-lg font-bold text-court-bg sm:w-auto"
          >
            Start the debate
          </button>
          <p className="mt-3 text-sm text-court-muted">
            {isMovies
              ? "Tip: add a dislike like “no horror” to watch the judge veto it live."
              : "Tip: add a dislike like “no sushi” to watch the judge veto it live."}
          </p>
        </div>

        <HistorySection />
      </main>

      <footer className="border-t border-court-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-court-subtle sm:px-6">
          Gavel · The Disagreement Engine. Two advocates argue, one judge
          rules, every claim carries its evidence.
        </p>
      </footer>
    </div>
  );
}
