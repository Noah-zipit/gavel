# Gavel — The Disagreement Engine

Two advocate agents argue your options using real taste evidence. A judge agent vetoes whatever the group cannot stand, then delivers a verdict with receipts. Built for the Qloo Agentic Hackathon.

Live demo: https://gavel-undeadash1010.vercel.app

## What it does

You enter your group (2–6 people, each with a few taste keywords) and what you are deciding between (2–4 restaurants, or switch to Movies mode for films). Then the courtroom convenes:

1. Advocate A opens the case for the first option, Advocate B for the second. Three arguments each, every one citing real affinity data from the Qloo taste graph.
2. Both advocates rebut. The judge watches every argument for veto conditions — if one person's affinity for a candidate falls below the group's line (0.30), that candidate is struck, on the record, mid-debate.
3. The judge delivers a verdict: winner, a proof chain of every scoring step, and a shareable verdict card you can send back to the group chat.

It works with your own people and your own options. The demo data is pre-filled so you can also just press start.

## Features

- Custom groups and candidates, with real Qloo entity resolution behind every keyword
- Dining and Movies modes (Qloo place and movie entities)
- Deterministic judge: veto rules and scoring are code, not vibes, so the verdict is reproducible
- Live debate transcript with evidence chips, tug-of-war score meter, and a taste-graph evidence board
- Veto objection moment mid-debate when a candidate gets struck
- Verdict share card: a 1080×1350 image rendered on canvas, shareable to WhatsApp/Instagram or downloadable
- Debate history saved on-device
- NVIDIA NIM writes the advocates' arguments (with local Ollama and template fallbacks)

## How Qloo is used

Qloo is load-bearing here, not decorative. Every seed keyword resolves through the Qloo `/search` API into real entities and tags, which form each person's taste graph. Candidates resolve to Qloo place/movie entities with real tags and popularity. Affinity is computed from keyword signal, tag overlap (Jaccard), and popularity.

One honest caveat: Qloo's `/v2/insights` endpoint returns empty entities in the hackathon environment (verified live, documented in `docs/ARCHITECTURE.md`), so scoring is built on `/search` entity data rather than the insights API. If that endpoint starts returning data, the adapter is structured to use it.

## Tech

Next.js 16, TypeScript, Tailwind v4. The debate runs as 5 short stateless stages (`POST /api/debate/stage`: opening-a → opening-b → rebuttal-a → rebuttal-b → verdict), each finishing well under the 60s Vercel serverless limit. The client chains the stages and replays the drama beats locally. Advocate prose comes from NVIDIA NIM (`moonshotai/kimi-k3`).

## Run it yourself

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000. Without keys the UI renders, but live debates need them.

| Variable | Purpose |
|---|---|
| `QLOO_API_KEY` | Qloo API key (`X-Api-Key` header) |
| `QLOO_BASE_URL` | Defaults to `https://hackathon.api.qloo.com` |
| `QLOO_ADAPTER` | Set to `mock` to force fixture data even with a key set |
| `NVIDIA_API_KEY` | NVIDIA NIM key for advocate argument text |
| `NVIDIA_MODEL` | Defaults to `moonshotai/kimi-k3` |
| `NVIDIA_BASE_URL` | Defaults to `https://integrate.api.nvidia.com/v1` |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Self-hosted fallback when no NIM key is set |

Never commit real key values. `.env` is gitignored.

## Deploy

Standard Next.js on Vercel. Import the repo, set `QLOO_API_KEY`, `QLOO_BASE_URL`, and `NVIDIA_API_KEY` in project environment variables, deploy. No extra build config.

## Hackathon

Built for the Qloo Agentic Hackathon (deadline October 30, 2026). Submission draft lives in `DEVPOST.md`. Solo entry.

## License

MIT. See `LICENSE`.
