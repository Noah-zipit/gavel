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
  { stroke: "#e8a33d", dim: "rgba(232,163,61,0.35)" }, // amber
  { stroke: "#3fb6a8", dim: "rgba(63,182,168,0.35)" }, // teal
  { stroke: "#d4af37", dim: "rgba(212,175,55,0.35)" }, // gold
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
      <h2 className="mb-3 text-sm font-bold tracking-[0.18em] text-court-muted">
        EVIDENCE BOARD
      </h2>

      {placed.length === 0 ? (
        <p className="py-10 text-center text-sm text-court-muted">
          Nodes light up as the advocates cite taste evidence.
        </p>
      ) : (
        <svg
          viewBox="0 0 440 380"
          role="img"
          aria-label={`Taste preference graph for ${groupSize} people across ${toneCount} options.`}
          className="h-auto w-full"
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
                  fill="#1d2026"
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
                  fill="#f2f4f7"
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
                  fill="#9aa3b2"
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
              fill="#15171c"
              stroke="#d4af37"
              strokeWidth={2.5}
            />
            <text
              x={CENTER.x}
              y={CENTER.y - 2}
              textAnchor="middle"
              fill="#f2f4f7"
              fontSize="16"
              fontWeight="800"
            >
              {groupSize}
            </text>
            <text
              x={CENTER.x}
              y={CENTER.y + 16}
              textAnchor="middle"
              fill="#f2f4f7"
              fontSize="12"
              fontWeight="700"
              letterSpacing="1"
            >
              {groupSize === 1 ? "PERSON" : "PEOPLE"}
            </text>
          </g>
        </svg>
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
