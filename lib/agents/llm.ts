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
const NIM_TIMEOUT_MS = 30_000;

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
  return process.env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";
}

function nimApiKey(): string | undefined {
  return process.env.NVIDIA_API_KEY || undefined;
}

// NimAdapter: NVIDIA NIM via its OpenAI-compatible chat completions endpoint.
export class NimAdapter implements LlmAdapter {
  async generate(prompt: string): Promise<string> {
    const key = nimApiKey();
    if (!key) {
      throw new Error("NVIDIA_API_KEY is not set");
    }
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
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 220,
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
      const text = (data.choices?.[0]?.message?.content ?? "").trim();
      if (!text) {
        throw new Error("NIM returned an empty response");
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
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
export class TemplateArguer implements LlmAdapter {
  async generate(prompt: string): Promise<string> {
    const { kind, candidate, topLabel, topDetail, weight, opponentSummary } =
      this.parsePrompt(prompt);

    const pct = Math.round(weight * 100);
    if (kind === "rebuttal") {
      return (
        `Your honor, the opposition leans on this: ${opponentSummary} ` +
        `But the numbers cut the other way. ${topLabel}: ${topDetail} ` +
        `That is a ${pct}% taste-graph signal for ${candidate}, and signals do not argue back.`
      );
    }
    return (
      `${candidate} wins on ${topLabel}. ${topDetail} ` +
      `A ${pct}% alignment from the taste graph is not an opinion, it is arithmetic.`
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
  } {
    const out = {
      kind: "opening",
      candidate: "our candidate",
      topLabel: "taste-graph alignment",
      topDetail: "the taste graph favors our candidate.",
      weight: 0.5,
      opponentSummary: "the other side's best claim.",
    };
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
