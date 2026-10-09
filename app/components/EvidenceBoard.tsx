"use client";

interface BoardNode {
  /** must match the API: `${personId}-${cuisine.toLowerCase()}` */
  id: string;
  name: string;
  cuisine: string;
  /** 0-100 affinity */
  weight: number;
  tone: "amber" | "teal";
  x: number;
  y: number;
}

/**
 * Fixed layout in a 440x380 viewBox. Left column = Italian affinity
 * (amber), right column = Japanese affinity (teal), center = the party.
 * Node ids and weights mirror the evidence fixtures the debate argues
 * from, so `evidence` events light the right node.
 */
const NODES: BoardNode[] = [
  { id: "alex-italian", name: "Alex", cuisine: "Italian", weight: 92, tone: "amber", x: 82, y: 62 },
  { id: "sara-italian", name: "Sara", cuisine: "Italian", weight: 87, tone: "amber", x: 82, y: 145 },
  { id: "jordan-italian", name: "Jordan", cuisine: "Italian", weight: 74, tone: "amber", x: 82, y: 228 },
  { id: "micah-italian", name: "Micah", cuisine: "Italian", weight: 83, tone: "amber", x: 82, y: 311 },
  { id: "alex-japanese", name: "Alex", cuisine: "Japanese", weight: 71, tone: "teal", x: 358, y: 62 },
  { id: "sara-japanese", name: "Sara", cuisine: "Japanese", weight: 18, tone: "teal", x: 358, y: 145 },
  { id: "jordan-japanese", name: "Jordan", cuisine: "Japanese", weight: 65, tone: "teal", x: 358, y: 228 },
  { id: "micah-japanese", name: "Micah", cuisine: "Japanese", weight: 69, tone: "teal", x: 358, y: 311 },
];

const CENTER = { x: 220, y: 187 };

const TONE = {
  amber: { stroke: "#e8a33d", dim: "rgba(232,163,61,0.35)" },
  teal: { stroke: "#3fb6a8", dim: "rgba(63,182,168,0.35)" },
} as const;

interface EvidenceBoardProps {
  litNodes: Set<string>;
}

export default function EvidenceBoard({ litNodes }: EvidenceBoardProps) {
  return (
    <section
      aria-label="Evidence board"
      className="flex min-h-0 flex-col rounded-lg border border-court-border bg-court-panel p-4 sm:p-5"
    >
      <h2 className="mb-3 text-sm font-bold tracking-[0.18em] text-court-muted">
        EVIDENCE BOARD
      </h2>

      <svg
        viewBox="0 0 440 380"
        role="img"
        aria-label="Taste preference graph for the four friends. Italian affinity: Alex 92, Sara 87, Micah 83, Jordan 74 percent. Japanese affinity: Alex 71, Micah 69, Jordan 65, Sara 18 percent."
        className="h-auto w-full"
      >
        {/* edges */}
        {NODES.map((n) => {
          const tone = TONE[n.tone];
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

        {/* satellite nodes */}
        {NODES.map((n) => {
          const tone = TONE[n.tone];
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
                {n.name}
              </text>
              <text
                x={n.x}
                y={n.y + 8}
                textAnchor="middle"
                fill={tone.stroke}
                fontSize="11"
                fontWeight="600"
              >
                {n.cuisine}
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

        {/* center node */}
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
            4
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
            FRIENDS
          </text>
        </g>
      </svg>

      <div className="mt-3 border-t border-court-border pt-3 text-sm text-court-muted">
        <p>
          <span className="font-bold text-court-amber">Amber</span> = Italian
          affinity
        </p>
        <p className="mt-1">
          <span className="font-bold text-court-teal">Teal</span> = Japanese
          affinity
        </p>
      </div>
    </section>
  );
}
