"use client";

export interface BoardNode {
  id: string;
  personName: string;
  candidateName: string;
  /** 0-100 affinity */
  weight: number;
  /** candidate index -> tone */
  candidateIndex: number;
}

const TONES = [
  { stroke: "#dda02f", dim: "rgba(221,160,47,0.35)" }, // amber
  { stroke: "#34b3a5", dim: "rgba(52,179,165,0.35)" }, // teal
  { stroke: "#e0b83c", dim: "rgba(224,184,60,0.35)" }, // gold
  { stroke: "#e07a5f", dim: "rgba(224,122,95,0.35)" }, // clay
] as const;

const TONE_NAMES = ["Amber", "Teal", "Gold", "Clay"];

const CENTER = { x: 220, y: 190 };
const RADIUS_X = 150;
const RADIUS_Y = 140;

/** Position nodes on an ellipse around the center; columns for 2 candidates. */
function layout(nodes: BoardNode[]): Array<BoardNode & { x: number; y: number }> {
  const byCand = new Map<number, BoardNode[]>();
  for (const n of nodes) {
    const arr = byCand.get(n.candidateIndex) ?? [];
    arr.push(n);
    byCand.set(n.candidateIndex, arr);
  }
  const candIndices = [...byCand.keys()].sort((a, b) => a - b);
  const out: Array<BoardNode & { x: number; y: number }> = [];

  if (candIndices.length <= 2) {
    // Two-column layout (classic courtroom look).
    for (const ci of candIndices) {
      const col = byCand.get(ci)!;
      const x = ci % 2 === 0 ? 82 : 358;
      col.forEach((n, j) => {
        const y =
          col.length === 1
            ? CENTER.y
            : 62 + j * ((380 - 124) / Math.max(1, col.length - 1));
        out.push({ ...n, x, y });
      });
    }
  } else {
    // Radial layout for 3-4 candidates.
    const total = nodes.length;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      out.push({
        ...n,
        x: CENTER.x + RADIUS_X * Math.cos(angle),
        y: CENTER.y + RADIUS_Y * Math.sin(angle),
      });
    });
  }
  return out;
}

interface EvidenceBoardProps {
  litNodes: Set<string>;
  nodes: BoardNode[];
  groupSize: number;
}

function shortName(s: string, max = 10): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Mobile layout: the node graph collapses into a dense affinity list on
 * phone widths. The graph's radial ring leaves the middle empty and its
 * labels shrink to illegible sizes; the list keeps every row legible and
 * still lights up as the advocates cite evidence.
 */
function MobileList({
  nodes,
  litNodes,
}: {
  nodes: BoardNode[];
  litNodes: Set<string>;
}) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {nodes.map((n) => {
        const tone = TONES[n.candidateIndex % TONES.length]!;
        const lit = litNodes.has(n.id);
        return (
          <li
            key={n.id}
            className={`rounded-md border px-3 py-2.5 ${
              lit
                ? "border-court-border-strong bg-court-panel"
                : "border-court-border bg-court-bg opacity-60"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-court-text">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: lit ? tone.stroke : tone.dim }}
                />
                <span className="truncate">{n.personName}</span>
              </p>
              <p
                className="shrink-0 text-sm font-bold"
                style={{ color: lit ? tone.stroke : "var(--court-muted)" }}
              >
                {n.weight}%
              </p>
            </div>
            <p className="mt-0.5 truncate text-xs text-court-muted">
              {n.candidateName} affinity
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-court-border/60"
              role="img"
              aria-label={`${n.personName}: ${n.weight}% affinity with ${n.candidateName}`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${n.weight}%`,
                  background: lit ? tone.stroke : tone.dim,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function EvidenceBoard({
  litNodes,
  nodes,
  groupSize,
}: EvidenceBoardProps) {
  const placed = layout(nodes);
  const toneCount = Math.max(1, new Set(nodes.map((n) => n.candidateIndex)).size);

  return (
    <section
      aria-label="Evidence board"
      className="flex min-h-0 flex-col rounded-lg border border-court-border bg-court-panel p-4 sm:p-5"
    >
      <h2 className="eyebrow mb-3 text-court-muted">Evidence board</h2>

      {placed.length === 0 ? (
        <p className="py-10 text-center text-sm text-court-muted">
          Nodes light up as the advocates cite taste evidence.
        </p>
      ) : (
        <>
          <MobileList nodes={placed} litNodes={litNodes} />
          <svg
            viewBox="0 0 440 380"
            role="img"
            aria-label={`Taste preference graph for ${groupSize} people across ${toneCount} options.`}
            className="hidden h-auto w-full sm:block"
          >
          {placed.map((n) => {
            const tone = TONES[n.candidateIndex % TONES.length]!;
            const lit = litNodes.has(n.id);
            return (
              <line
                key={`edge-${n.id}`}
                x1={CENTER.x}
                y1={CENTER.y}
                x2={n.x}
                y2={n.y}
                stroke={lit ? tone.stroke : tone.dim}
                strokeWidth={lit ? 3 : 1 + (n.weight / 100) * 2.5}
                strokeLinecap="round"
              />
            );
          })}

          {placed.map((n) => {
            const tone = TONES[n.candidateIndex % TONES.length]!;
            const lit = litNodes.has(n.id);
            return (
              <g key={n.id} className={lit ? "node-lit" : undefined}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={30}
                  fill="var(--court-panel)"
                  stroke={lit ? tone.stroke : tone.dim}
                  strokeWidth={lit ? 3 : 2}
                  className={lit ? "node-glow" : undefined}
                  style={
                    lit
                      ? ({ "--node-color": tone.stroke } as React.CSSProperties)
                      : undefined
                  }
                />
                <text
                  x={n.x}
                  y={n.y - 8}
                  textAnchor="middle"
                  fill="var(--court-text)"
                  fontSize="13"
                  fontWeight="700"
                >
                  {shortName(n.personName)}
                </text>
                <text
                  x={n.x}
                  y={n.y + 8}
                  textAnchor="middle"
                  fill={tone.stroke}
                  fontSize="11"
                  fontWeight="600"
                >
                  {shortName(n.candidateName)}
                </text>
                <text
                  x={n.x}
                  y={n.y + 22}
                  textAnchor="middle"
                  fill="var(--court-muted)"
                  fontSize="11"
                  fontWeight="600"
                >
                  {n.weight}%
                </text>
              </g>
            );
          })}

          <g>
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={38}
              fill="var(--court-bg)"
              stroke="var(--court-gold)"
              strokeWidth={2.5}
            />
            <text
              x={CENTER.x}
              y={CENTER.y - 2}
              textAnchor="middle"
              fill="var(--court-text)"
              fontSize="16"
              fontWeight="800"
            >
              {groupSize}
            </text>
            <text
              x={CENTER.x}
              y={CENTER.y + 16}
              textAnchor="middle"
              fill="var(--court-text)"
              fontSize="12"
              fontWeight="700"
              letterSpacing="1"
            >
              {groupSize === 1 ? "PERSON" : "PEOPLE"}
            </text>
          </g>
        </svg>
        </>
      )}

      <div className="mt-3 border-t border-court-border pt-3 text-sm text-court-muted">
        {Array.from({ length: toneCount }, (_, i) => (
          <p key={i} className={i > 0 ? "mt-1" : undefined}>
            <span
              className="font-bold"
              style={{ color: TONES[i % TONES.length]!.stroke }}
            >
              {TONE_NAMES[i % TONE_NAMES.length]}
            </span>{" "}
            = {placed.find((n) => n.candidateIndex === i)?.candidateName ?? `Option ${i + 1}`} affinity
          </p>
        ))}
      </div>
    </section>
  );
}
