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
| `NVIDIA_API_KEY` | —                              | NVIDIA NIM key — advocates argue through it when set |
| `NVIDIA_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` | NIM model for argument text           |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | NIM API base URL                   |
| `OLLAMA_HOST`  | —                                | Self-hosted LLM endpoint (fallback when no NIM key) |
| `OLLAMA_MODEL` | —                                | Model name served at `OLLAMA_HOST`          |

Never commit real key values. `.env` is gitignored; `.env.example`
documents the shape.

## Deployment (Vercel)

The courtroom debate runs as **5 short stages** (`POST /api/debate/stage`:
`opening-a` → `opening-b` → `rebuttal-a` → `rebuttal-b` → `verdict`), each
stateless and each finishing well under the 60s Vercel Hobby function limit
(`maxDuration = 60` is set on the route; 3 parallel NIM calls ≈ 30s worst
case). The client chains them and replays the 700ms drama beats locally, so
the trial looks and feels identical to the original stream.

To ship it (owner's call — needs his unpaused Vercel account):

1. Push this repo to GitHub (public, MIT).
2. Vercel dashboard → Add New → Project → import the repo. Framework preset:
   Next.js. No extra build config needed.
3. Project → Settings → Environment Variables → add:
   - `QLOO_API_KEY` — Qloo Taste API key (hackathon tier)
   - `QLOO_BASE_URL` — `https://hackathon.api.qloo.com`
   - `NVIDIA_API_KEY` — NVIDIA NIM key for advocate argument text
4. Deploy. No code changes needed; no secrets live in the repo.

## Production notes

- Custom 404, favicon, and page metadata ship with the demo build.
- Terms of Service / Privacy pages are deferred: this is a hackathon demo with
  no user accounts and no user data collected. They become required before any
  public production launch.
