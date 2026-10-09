# Devpost Submission Draft — Gavel: The Disagreement Engine

> Draft for the Qloo Agentic Hackathon. Paste into the Devpost project fields.
> All claims below are factual as of 2026-10-09. Do not add metrics that were
> not measured.

---

## Project name

Gavel — The Disagreement Engine

## Tagline

Two AI advocates argue your group's options with live taste evidence. A judge
agent vetoes what the group cannot stand and delivers a verdict with receipts.

## Description

Group decisions die in the group chat. Four friends, one Friday night, two
restaurants, zero agreement. Gavel settles it the way disagreements deserve to
be settled: with a trial.

Gavel is a Disagreement Engine. Instead of asking one AI for a recommendation,
it puts two advocate agents on opposite sides of the question and lets them
debate using real taste-graph evidence, while a third agent — the judge —
rules on the outcome. The whole thing streams live in the browser as an AI
Courtroom: candidate cards, a tug-of-war score meter, a live transcript with
evidence chips, an evidence board that lights up as arguments land, and a
verdict banner with a full proof chain.

**How a session works**

1. You add your people (2–6) with taste keywords, and your options (2–4
   restaurants, or 2–4 movies in Movies mode).
2. Advocate A and Advocate B each rank every piece of taste evidence by
   weight, take the top three, and argue. Rebuttals quote the opponent's
   actual claims and answer them with counter-evidence. Nothing is scripted;
   change the taste data and the arguments change.
3. The judge checks vetoes: anyone whose taste affinity for a candidate drops
   below 0.30 vetoes it, and a vetoed candidate loses automatically. The
   highest remaining group affinity wins.
4. The verdict arrives with receipts: an ordered proof chain, vetoes first,
   then every person's affinity line. One tap shares the verdict back to the
   group chat.

**Key features**

- Custom groups and candidates: your people, your options, your tastes.
- Dining and Movies modes: the same engine argues restaurants or films.
- Live courtroom UI: transcript, tug-of-war meter, evidence board, verdict.
- Deterministic judge: vetoes and decisions are rules, not vibes.
- Shareable verdicts and a local debate history.

## How Qloo powers it

Qloo is load-bearing, not decorative. Remove the taste graph and the product
collapses: the advocates would have no evidence to rank, the judge would have
no affinities to check, and there would be no veto and no decision.

- Every person seed (a favorite artist, a dish, a film) is resolved through
  Qloo's `/search` API to a real entity with its tag set.
- Every candidate is resolved to a Qloo entity (`urn:entity:place` for
  dining, `urn:entity:movie` for films) with its tags and popularity.
- Affinity is computed from that data: keyword overlap with the person's
  taste seeds (explicit dislikes like "no sushi" push hard toward a veto),
  Jaccard similarity of the two Qloo tag sets, and the entity's popularity
  as a quality prior.
- Every argument's evidence chip cites the actual Qloo tags and entities
  behind it. The proof chain is built from the same scores.

Note: Qloo's `/v2/insights` endpoint returns empty entity lists in the
hackathon environment (verified live), so scoring is computed deterministically
from live `/search` entity data rather than the insights API.

## Tech stack

Next.js 16, TypeScript, Tailwind CSS, Vercel. Argument wording comes from a
pluggable LLM layer (NVIDIA NIM in production, local Ollama as fallback, with
a deterministic evidence-only template as the final fallback so a debate
always runs). The judge is fully deterministic. The debate runs as five
stateless POST stages (opening A/B, rebuttal A/B, verdict) so each serverless
invocation finishes well under function timeouts.

## Team

Solo build by Ashar Qaisar (Noah-zipit).

## Links

- Live demo: https://gavel-undeadash1010.vercel.app
- Public repo: https://github.com/Noah-zipit/gavel (MIT license)

## Built with

Qloo API, NVIDIA NIM, Next.js, Vercel.
