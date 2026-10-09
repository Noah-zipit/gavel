// LLM layer for the advocates and judge.
//
// getLlm() tries, in order: NVIDIA NIM (if NVIDIA_API_KEY is set) → Ollama →
// TemplateArguer (deterministic, evidence-driven templates) on ANY error. The
// debate must run even with no LLM and no network, so this never rejects: the
// template fallback always succeeds.

export interface LlmAdapter {
  generate(prompt: string): Promise<string>;
}

const OLLAMA_TIMEOUT_MS = 20_000;
const NIM_TIMEOUT_MS = 90_000;

function ollamaHost(): string {
  return (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
}

function ollamaModel(): string {
  return process.env.OLLAMA_MODEL ?? "llama3.1";
}

function nimBaseUrl(): string {
  return (process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(
    /\/+$/,
    ""
  );
}

function nimModel(): string {
  return process.env.NVIDIA_MODEL ?? "moonshotai/kimi-k3";
}

function nimApiKey(): string | undefined {
  return process.env.NVIDIA_API_KEY || undefined;
}

// NimAdapter: NVIDIA NIM via its OpenAI-compatible chat completions endpoint.
// The default model is a reasoning model that emits its thinking trace, so we
// ask it to wrap the final argument in [ARGUMENT]...[/ARGUMENT] markers.
// Extraction tries, in order: the last *usable* marker block, then the last
// "Drafting - Attempt N:" draft from the thinking trace (the model's own
// final draft is usually clean courtroom prose).
export class NimAdapter implements LlmAdapter {
  // Pull the model's final draft out of its thinking trace, e.g.
  //   4.  **Drafting - Attempt 2:**
  //      <argument sentences>
  //
  //      Check constraints:
  private extractAttemptBlock(text: string): string | null {
    const re =
      /Drafting - Attempt \d+:\*\*\s*\n([\s\S]*?)(?=\n\s*Check constraints:|\n\s*\d+\.\s+\*\*|$)/g;
    let last: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      last = m[1];
    }
    if (!last) return null;
    const cleaned = last
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(" ")
      .trim();
    return cleaned || null;
  }

  private candidateBlocks(text: string): string[] {
    const out: string[] = [];
    const markerRe = /\[ARGUMENT\]([\s\S]*?)\[\/ARGUMENT\]/g;
    let m: RegExpExecArray | null;
    while ((m = markerRe.exec(text)) !== null) {
      out.push(m[1].trim());
    }
    const attempt = this.extractAttemptBlock(text);
    if (attempt) out.push(attempt);
    return out;
  }

  private stripThinking(text: string): string {
    // Last usable block wins: a truncated final marker must not poison
    // extraction when an earlier complete draft exists.
    const blocks = this.candidateBlocks(text);
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (this.isUsableArgument(blocks[i]!)) return blocks[i]!;
    }
    // No markers or drafts: non-reasoning models (e.g. kimi-k3) answer
    // directly. As long as it isn't a thinking trace, the raw text is the
    // argument.
    const t = text.trim();
    if (!/^here's a thinking process:/i.test(t) && this.isUsableArgument(t)) {
      return t;
    }
    return "";
  }

  private isReasoningModel(): boolean {
    const m = nimModel().toLowerCase();
    return m.includes("nemotron") || m.includes("reasoning");
  }

  private isUsableArgument(text: string): boolean {
    const t = text.trim();
    if (t.length < 60 || t.length > 1200) return false;
    if (/your argument here/i.test(t)) return false;
    // Token salad: a glitching model emits control tokens like <|close|>.
    if ((t.match(/<\|[^|]*\|>/g) || []).length >= 2) return false;
    // Token salad: non-Latin script runs inside an English argument.
    const nonLatin = (t.match(/[一-鿿぀-ヿ가-힯]/g) || []).length;
    if (nonLatin > t.length * 0.05) return false;
    // Token salad: the same short token looped dozens of times ("54% ... 54%").
    // A real 2-3 sentence argument never repeats one token ten times.
    const counts = new Map<string, number>();
    for (const tok of t.toLowerCase().split(/\s+/)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
    for (const c of counts.values()) if (c > 10) return false;
    // Must read like prose: at least one substantial sentence.
    const sentences = t.split(/[.!?]/).map((s) => s.trim()).filter((s) => s.length > 20);
    return sentences.length >= 1;
  }

  async generate(prompt: string): Promise<string> {
    const key = nimApiKey();
    if (!key) {
      throw new Error("NVIDIA_API_KEY is not set");
    }
    // Reasoning models need the marker wrapper so we can strip the thinking
    // trace; direct models (kimi-k3) answer cleanly without it — and the
    // marker instruction can push them into degenerate output.
    const instruction = this.isReasoningModel()
      ? "\n\nThink briefly (a few steps at most). Then write your FINAL 2-3 " +
        "sentence argument between [ARGUMENT] and [/ARGUMENT] markers. Put " +
        "only the argument sentences between the markers, no placeholder " +
        "text. No em dashes."
      : "";
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NIM_TIMEOUT_MS);
      try {
        const res = await fetch(`${nimBaseUrl()}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: nimModel(),
            messages: [{ role: "user", content: prompt + instruction }],
            temperature: 0.7,
            max_tokens: 600,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const detail = (await res.text()).slice(0, 200);
          throw new Error(`NIM returned status ${res.status}: ${detail}`);
        }
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = (data.choices?.[0]?.message?.content ?? "").trim();
        if (!raw) {
          throw new Error("NIM returned an empty response");
        }
        const text = this.stripThinking(raw);
        if (this.isUsableArgument(text)) {
          return text;
        }
        lastError = new Error(
          `NIM returned unusable argument text (attempt ${attempt + 1})`
        );
      } catch (err) {
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("NIM failed");
  }
}

export class OllamaAdapter implements LlmAdapter {
  async generate(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const res = await fetch(`${ollamaHost()}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel(),
          prompt,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`ollama returned status ${res.status}`);
      }
      const data = (await res.json()) as { response?: string };
      const text = (data.response ?? "").trim();
      if (!text) {
        throw new Error("ollama returned an empty response");
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}

// TemplateArguer: deterministic, evidence-driven fallback. It does not invent
// arguments; it renders the supplied evidence into courtroom phrasing. Prompts
// embed evidence as JSON, so the template can extract label/detail/weight.
// Side-aware: Advocate A argues numbers-first and clipped; Advocate B argues
// people-first and warmer. Neither ever uses the banned slogan phrases.
export class TemplateArguer implements LlmAdapter {
  async generate(prompt: string): Promise<string> {
    const { kind, candidate, topLabel, topDetail, weight, opponentSummary, side } =
      this.parsePrompt(prompt);

    const pct = Math.round(weight * 100);
    const weak = weight < 0.3;
    if (kind === "rebuttal") {
      if (side === "B") {
        return (
          `They argue this: ${opponentSummary} ` +
          `But ${topDetail} ` +
          `${topLabel} favors ${candidate}, and that is what matters at this table.`
        );
      }
      return (
        `The opposition leans on this: ${opponentSummary} ` +
        `The numbers cut the other way. ${topLabel}: ${topDetail} ` +
        (weak
          ? `Support is thin at ${pct}%, but the other side has less.`
          : `${pct}% for ${candidate}. Count it.`)
      );
    }
    if (side === "B") {
      return (
        `${topDetail} ` +
        `${topLabel}, and it points at ${candidate}. That is the people's pick.`
      );
    }
    return (
      `${candidate}: ${topLabel}. ${topDetail} ` +
      (weak
        ? `Only ${pct}%, and nobody loves it. But nobody is vetoing it either.`
        : `${pct}% alignment. Arithmetic, not opinion.`)
    );
  }

  // The advocate prompts embed a JSON block between markers; parse defensively.
  private parsePrompt(prompt: string): {
    kind: string;
    candidate: string;
    topLabel: string;
    topDetail: string;
    weight: number;
    opponentSummary: string;
    side: "A" | "B";
  } {
    const out = {
      kind: "opening",
      candidate: "our candidate",
      topLabel: "taste-graph alignment",
      topDetail: "the taste graph favors our candidate.",
      weight: 0.5,
      opponentSummary: "the other side's best claim.",
      side: "A" as "A" | "B",
    };
    const sideMatch = prompt.match(/You are Advocate ([AB])\b/);
    if (sideMatch?.[1] === "B") out.side = "B";
    const m = prompt.match(/\[EVIDENCE_JSON\]([\s\S]*?)\[\/EVIDENCE_JSON\]/);
    if (m?.[1]) {
      try {
        const j = JSON.parse(m[1]) as {
          kind?: string;
          candidate?: string;
          topLabel?: string;
          topDetail?: string;
          weight?: number;
          opponentSummary?: string;
        };
        if (j.kind) out.kind = j.kind;
        if (j.candidate) out.candidate = j.candidate;
        if (j.topLabel) out.topLabel = j.topLabel;
        if (j.topDetail) out.topDetail = j.topDetail;
        if (typeof j.weight === "number") out.weight = j.weight;
        if (j.opponentSummary) out.opponentSummary = j.opponentSummary;
      } catch {
        // Keep defaults; templates must never fail.
      }
    }
    return out;
  }
}

export function getLlm(): LlmAdapter {
  const nim = new NimAdapter();
  const ollama = new OllamaAdapter();
  const template = new TemplateArguer();
  return {
    async generate(prompt: string): Promise<string> {
      if (nimApiKey()) {
        try {
          return await nim.generate(prompt);
        } catch (err) {
          console.warn(
            `llm: NIM unavailable (${err instanceof Error ? err.message : "unknown"}); trying Ollama`
          );
        }
      }
      try {
        return await ollama.generate(prompt);
      } catch (err) {
        console.warn(
          `llm: ollama unavailable (${err instanceof Error ? err.message : "unknown"}); using template fallback`
        );
        return template.generate(prompt);
      }
    },
  };
}
