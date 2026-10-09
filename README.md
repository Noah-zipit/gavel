# Gavel — The Disagreement Engine

Adversarial AI agents that settle group decisions. Two advocates each argue a
candidate from real taste-graph evidence while a judge agent watches for veto
conditions, then delivers a verdict with receipts. The Qloo Agentic Hackathon
demo is the AI Courtroom for group dining: four friends, one Friday night, and a
live debate over where to eat.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` and fill in keys
before running a live debate (the UI renders with mock data without them).

## Environment variables

| Variable       | Default                          | Purpose                                     |
|----------------|----------------------------------|---------------------------------------------|
| `QLOO_API_KEY` | —                                | Qloo taste-graph API key (hackathon tier)   |
| `QLOO_BASE_URL`| `https://hackathon.api.qloo.com` | Qloo API base URL                           |
| `QLOO_ADAPTER` | —                                | Set to `mock` to force the fixture adapter, even with a key set |
| `OLLAMA_HOST`  | —                                | Self-hosted LLM endpoint for the judge/advocate agents |
| `OLLAMA_MODEL` | —                                | Model name served at `OLLAMA_HOST`          |

## Deployment

> Do NOT deploy to Vercel yet. The owner's team (`noahext994-4907s-projects`) was
> paused on 2026-10-09 for bandwidth overage. Deployment is a pending step: it
> proceeds only after the owner resolves the paused team, at which point the app
> ships from `Noah-zipit/gavel` with the repo-local identity
> `Noah-zipit <noahext994@gmail.com>`.

## Production notes

- Custom 404, favicon, and page metadata ship with the demo build.
- Terms of Service / Privacy pages are deferred: this is a hackathon demo with
  no user accounts and no user data collected. They become required before any
  public production launch.
