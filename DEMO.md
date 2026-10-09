# DEMO.md — The 2-Minute Courtroom Script

The AI Courtroom, performed live for the judges. Open the courtroom in the
browser, the question already on screen: **"Where do four friends eat Friday
night?"** — Casa di Roma (Italian) vs Sakura Sushi (Japanese).

## 0:00 — The question

"The most argued question in every group chat. Four friends, one Friday night,
and two restaurants. Instead of asking an AI for a suggestion, we let two AI
agents argue it out in front of a judge." Press **Start**.

## 0:15 — Opening arguments stream in

Advocate A (amber) opens for Casa di Roma, Advocate B (teal) opens for Sakura
Sushi, three arguments each. Every argument carries an evidence chip naming its
source, like "Sara's taste graph — 92%". The tug-of-war meter swings with every
argument. Say: "The advocates are not reading a script. Each argument is the
top-ranked piece of evidence from the group's actual taste data."

## 0:45 — Rebuttals, and the evidence board lights up

The advocates answer each other's claims directly. Meanwhile the evidence
board fills in: one node per person, colored by preference, edge weights from
taste-graph overlap. Say: "The board is the case file. Every argument the
agents make points at a node on it."

## 1:15 — The veto moment

The judge reads the veto check. Sara's sushi affinity is 0.18, below the 0.30
line. Sakura Sushi is vetoed and struck out of the case. **Pause here and let
it land.** Then: "This is the whole point. No amount of good arguing beats a
hard no from the data. The judge does not vote on vibes; it enforces the
threshold."

## 1:30 — Verdict with receipts

Casa di Roma wins. The gold verdict banner drops with the proof chain: the
veto, then every person's affinity heaviest first, then the final score.
"Every line is a receipt. You can read the entire decision backwards from the
verdict to the raw taste data."

## 1:50 — The one-liner for judges

"Remove the taste graph and the advocates have no evidence. The debate
collapses. The argument is the product, not the prompt."

## Fallback notes

- If the Qloo API is down, the mock adapter takes over automatically. The
  debate still runs, the veto still fires, the verdict still lands. Nobody in
  the audience can tell unless you check `/api/health`, which reports which
  evidence source is live.
- Keep a **second browser tab** open with the courtroom idle. If the stream
  ever stalls, switch tabs and press Start again on a fresh session rather
  than debugging in front of the judges.
- The language model is optional. Without Ollama running, the advocates use
  the built-in template renderer and the debate is fully deterministic, which
  makes rehearsal timings exact.
