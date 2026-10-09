# Architecture — The Disagreement Engine

The system that powers Gavel. Written so Ashar can narrate it to hackathon
judges without needing to be an expert: every term is explained as it appears.

## Overview

Gavel is a Disagreement Engine: software that settles group decisions by making
AI agents argue them out. Instead of asking one AI for a recommendation, Gavel
puts two advocate agents on opposite sides of a question, lets them debate using
real taste-graph evidence, and has a third agent — the judge — rule on the
outcome with receipts.

The hackathon demo is the AI Courtroom for group dining. Four friends in Lahore,
one Friday night, one question: where do we eat? Two candidates: Casa di Roma
(Italian) and Sakura Sushi (Japanese). The advocates argue. The judge rules.
The whole thing streams live in the browser as it happens.

## Multi-agent design

Three agents, three jobs. All of them live in `lib/agents/`.

**Advocate A and Advocate B** (`lib/agents/advocate.ts`). Each advocate is
assigned one candidate and one job: argue for it, hard. They do not work from a
script. Each advocate receives the group's full evidence for its candidate
(every person's taste-graph affinity plus every piece of evidence) and runs the
same selection rule: rank every piece of evidence by weight, keep the top three
with distinct labels. Those three become the three arguments. Nothing about the
arguments is hard-coded; if the taste data changes, the arguments change.

Rebuttals are genuinely adversarial, not decorative. The rebuttal pass feeds
each advocate the opponent's actual opening text. Each rebuttal quotes or
summarizes the opponent's claim, then answers it with that advocate's own
heaviest evidence. The agents react to each other, which is what makes this a
debate rather than two monologues.

The advocates' wording comes from a pluggable LLM layer (`lib/agents/llm.ts`):
it tries a self-hosted Ollama model first, and if that is unavailable it falls
back to a deterministic template renderer that still only renders the supplied
evidence (the prompt carries the evidence in a JSON block the template parses).
The debate always runs, with or without a language model.

**The Judge** (`lib/agents/judge.ts`). Neutral, and fully deterministic, which
matters: the deciding step of a disagreement engine should never be vibes. The
judge does three things. First, it checks vetoes: it asks the evidence adapter
for each candidate's score against each person, and anyone whose affinity drops
below **0.30** vetoes the candidate. A vetoed candidate loses automatically, no
matter how good the arguments were. Second, it decides: the highest total group
affinity among the non-vetoed candidates wins. Third, it builds the proof chain:
an ordered list of receipt lines, vetoes first, then every person's affinity
line heaviest first, then the final verdict. That chain is what the verdict
banner shows.

Why this is genuinely agentic and not decorative: remove the taste graph and
everything breaks. The advocates would have no evidence to rank, so their
arguments would have no content. The judge would have no affinities to check,
so there would be no veto and no decision. The debate is downstream of the
data. The agents are the machinery that turns evidence into a contested,
verifiable decision.

## Evidence adapters

Evidence is the data layer. One interface, two implementations, both in
`lib/evidence/`.

The **EvidenceAdapter interface** (`lib/evidence/types.ts`) is the contract every
agent and the API rely on:

- `resolvePerson(seeds)` — turn seed tastes (artist names) into a person record.
- `scoreCandidate(person, candidate)` — return the person's affinity (0 to 1)
  for a candidate plus the list of Evidence items behind it.
- `getVetoes(group, candidate)` — return the list of people whose affinity is
  below the veto threshold.

**RealQlooAdapter** (`lib/evidence/qloo.ts`) is the live implementation against
the Qloo Agentic Hackathon API. How it works and what it had to handle:

- Base URL comes from `QLOO_BASE_URL` (default `https://hackathon.api.qloo.com`).
- Authentication is the **`X-Api-Key` header only**. The key is read from the
  environment at request time and never logged, stored, or included in errors.
- Hackathon keys only work on the hackathon host; used anywhere else they get
  a 401, which the adapter treats as "API unavailable."
- Two endpoints: `/search` resolves restaurant names and seed artists to Qloo
  entity IDs. `/v2/insights` was investigated thoroughly (GET-only, all
  parameters on the query string, `filter.type` set to `urn:entity:place`,
  `urn:entity:artist`, `urn:entity:movie`, `urn:entity:brand`) and returns
  **empty entity lists for every filter in the hackathon environment** — it is
  effectively dead, so no scoring path depends on it.
- The quirks, all discovered live: invalid parameters are **silently ignored**,
  meaning the API returns 200 with an empty entity list instead of an error, so
  an empty result is always treated as a soft failure, never as "zero affinity."
  Food places must be queried with `filter.type=urn:entity:place` because
  `urn:entity:food_and_drink` returns a 403. Affinities sometimes arrive on a
  0-to-100 scale and are normalized to 0-to-1.
- The adapter keeps a 10-minute in-memory cache (keyed by request URL) so the
  live API is not hammered during a demo.
- Any failure — network, timeout, 401, 429, invalid JSON, empty results — throws
  `QlooUnavailableError`. That error is the signal for the fallback layer.

**MockQlooAdapter** (`lib/evidence/mock.ts`) is the deterministic stand-in:
hand-authored fixtures for the demo group (Alex, Sara, Jordan, Micah) and the
two candidates. The fixture plot: everyone leans Italian, and Sara's sushi
affinity is 0.18, below the 0.30 veto line, so Sakura Sushi gets vetoed. No raw
Qloo API responses are stored anywhere in the repo.

**CustomQlooAdapter** (`lib/evidence/custom.ts`) scores user-defined people and
candidates with real Qloo data — the working-prototype path. Since
`/v2/insights` is dead, affinity is computed from real `/search` entity data:

- Each person's taste seeds resolve via `/search` to Qloo entities; their tags
  become the person's taste graph. Seeds like "no sushi" or "hate fish" are
  parsed as explicit negatives (never sent to Qloo as entities).
- Each candidate resolves via `/search` with `types=urn:entity:place` to a real
  place entity; its tags and popularity are read from the live response.
- Affinity = 0.60 keyword signal + 0.25 tag overlap (Jaccard between the
  person's entity tags and the place's tags) + 0.15 place popularity, clamped
  to [0.05, 0.95]. The keyword signal starts at 0.50, gains +0.12 per positive
  seed-token match (expanded through a cuisine synonym map: sushi→japanese,
  pizza→italian, etc.), and loses −0.45 per negative match so an explicit
  dislike lands below the 0.30 veto threshold. Every evidence label cites the
  real Qloo tags behind the score; if place resolution fails after a retry, the
  score falls back to keyword signal alone (still real user data, flagged in
  the evidence detail) rather than failing the debate.

**Demo vs custom detection** (`lib/debate-setup.ts`): if the submitted names
exactly match the demo group (alex/sara/jordan/micah + casa di roma/sakura
sushi), the mock adapter is used so the scripted veto plot survives. Any edit
switches to the custom adapter with real scoring. The setup screen pre-fills
the demo data so judges can start instantly, and the verdict banner, candidate
cards, evidence board, and header all render from the API-returned data —
no hard-coded names remain in the UI.

**Fallback** (`lib/evidence/index.ts`): `getAdapter()` picks the real adapter
only when a key is configured (and `QLOO_ADAPTER` is not forced to `mock`).
`withFallback()` wraps the real adapter so the first `QlooUnavailableError`
permanently switches the rest of the debate to the mock adapter. The courtroom
never goes dark mid-demo.

## Debate protocol / SSE events

The API route `app/api/debate/route.ts` runs the whole session for
`GET /api/debate?group=friends-lahore` and streams it as Server-Sent Events.
The event shapes are defined once in `lib/debate-events.ts`, which both the
server and the browser client agree on.

**Round order** (with a 700 ms beat between steps so the courtroom has rhythm):

1. The evidence board lights up, one node per affinity as it resolves.
2. Opening arguments: Advocate A makes all three of its arguments, then
   Advocate B makes its three. Each argument is immediately followed by a
   score update.
3. Rebuttals: A answers B's openings, then B answers A's.
4. The veto check: the judge's vetoes stream out, if any.
5. The verdict: winner, loser, and the full proof chain.
6. `done`. Any failure anywhere emits `error` and closes the stream.

**Event shapes:**

- `argument` — `{ round: "opening" | "rebuttal", side: "A" | "B", text, evidence: { label, weight, detail } }`. Each argument carries its own evidence chip.
- `score` — `{ a, b, delta, reason }`. The tug-of-war meter reads these.
- `evidence` — `{ nodeId, lit }`. Lights nodes on the evidence board.
- `veto` — `{ candidateId, by, reason }`. The veto strike.
- `verdict` — `{ winnerId, loserId, proofChain: [{ step, evidence, weight }], summary }`. The receipts.
- `done` / `error` — end of stream.

**Score model:** the meter starts at 50/50. Every argument shifts the score by
`round(evidence weight * 12)` toward its side, symmetrically (what one side
gains, the other loses), clamped between 0 and 100. **Veto threshold:** 0.30
— any person's affinity under it vetoes the candidate, and a vetoed candidate
cannot win.

## UI

The courtroom is a Next.js 16 app with client components (`app/components/`),
all in dark-charcoal courtroom styling (see `DESIGN.md`):

- `Courtroom.tsx` — the orchestrator. Opens the SSE stream, parses events with
  `parseDebateEvent`, and fans them out to every panel. Also owns the Start
  flow and the LIVE state.
- `Header.tsx` — gavel mark, "AI COURTROOM" wordmark, the debate question, and
  the red LIVE badge while streaming.
- `CandidateCard.tsx` — one card per candidate: name, cuisine tags, rating,
  distance, price, match %, pros strip. Shows a strike animation when vetoed.
- `TugOfWar.tsx` — the score meter between the two cards, driven by `score`
  events. Amber side A, teal side B.
- `Transcript.tsx` — the live debate transcript: alternating advocate blocks,
  each with an evidence chip naming the source and its percentage.
- `EvidenceBoard.tsx` — the node graph of the group: a center node for the
  party, per-person nodes colored by preference, lighting up as `evidence`
  events arrive, with a legend.
- `VerdictBanner.tsx` — the solid gold verdict bar with the decision and the
  proof chain, rendered only when the judge has ruled.
- `candidates.ts` — static candidate facts for the demo; `icons.tsx` — matched
  SVG icons (no emoji, no lettermarks).

`GET /api/health` reports `{ status: "ok", evidence: "real-qloo" | "mock" }`,
which is how the UI and the demo operator know which evidence source is live.

## Demo

The two-minute demo script lives in `DEMO.md` at the repo root: the question,
the beats, the timestamps, the veto moment to let land, the one-liner for the
judges, and the fallback plan if the live API is down.
