/**
 * Canvas-rendered verdict share card (1080 x 1350, portrait).
 * Hand-rolled canvas drawing, no dependencies. Matches the app's
 * Linear-derived near-black system (see DESIGN.md tokens).
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

const BG = "#08080c";
const PANEL = "#0e0e13";
const TRACK = "#1a1a21";
const HAIRLINE = "#23252d";
const AMBER = "#dda02f";
const TEAL = "#34b3a5";
const GOLD = "#e0b83c";
const TEXT = "#f4f4f5";
const MUTED = "#a8adb8";
const SUBTLE = "#6e7480";

const STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export interface VerdictCardEvidence {
  label: string;
  pct: number;
}

export interface VerdictCardVeto {
  by: string;
  candidateName: string;
  reason: string;
}

export interface VerdictCardData {
  winnerName: string;
  /** Advocate A candidate name (left / amber side of the bar) */
  candidateAName: string;
  /** Advocate B candidate name (right / teal side of the bar) */
  candidateBName: string;
  /** 0-100 final lean for A */
  scoreA: number;
  /** 0-100 final lean for B */
  scoreB: number;
  veto: VerdictCardVeto | null;
  /** top evidence rows (trimmed to 2 on the card, matching the share text) */
  evidence: VerdictCardEvidence[];
  /** shown when evidence has no pct rows, e.g. "Decided by 8 evidence points." */
  evidenceFallbackNote: string;
  host: string;
  dateLabel: string;
}

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${STACK}`;
}

/** Centered text with manual letter-spacing (deterministic everywhere). */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number
): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i]! + tracking;
  });
  ctx.textAlign = prev;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrink font until text fits maxWidth (down to minSize). */
function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  minSize: number,
  weight: number
): number {
  let size = baseSize;
  ctx.font = font(weight, size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(weight, size);
  }
  return size;
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const M = 80; // side margin
const CONTENT_W = CARD_W - M * 2;

/**
 * Draw the verdict card. Returns the canvas (caller converts to
 * data URL / blob for preview and sharing).
 */
export function drawVerdictCard(data: VerdictCardData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;

  // --- background: near-black + subtle vignette via low-alpha arcs ---
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = "rgba(0,0,0,0.045)";
  ctx.lineWidth = 70;
  for (let r = 950; r >= 500; r -= 50) {
    ctx.beginPath();
    ctx.arc(CARD_W / 2, 620, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- hairline frame ---
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(37, 37, CARD_W - 74, CARD_H - 74);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const cx = CARD_W / 2;
  let y = 0;

  // --- eyebrow ---
  y = 158;
  ctx.fillStyle = AMBER;
  ctx.font = font(600, 30);
  tracked(ctx, "THE DISAGREEMENT ENGINE", cx, y, 10);

  // --- headline ---
  y += 118;
  ctx.fillStyle = TEXT;
  ctx.font = font(800, 104);
  tracked(ctx, "THE VERDICT", cx, y, -2);

  // --- winner name (fit, wrap to 2 lines max) ---
  const winnerSize = fitSize(ctx, data.winnerName, CONTENT_W, 88, 52, 800);
  ctx.font = font(800, winnerSize);
  ctx.fillStyle = GOLD;
  let winnerLines = wrapLines(ctx, data.winnerName, CONTENT_W);
  if (winnerLines.length > 2) {
    winnerLines = [
      winnerLines.slice(0, -1).join(" "),
      winnerLines[winnerLines.length - 1]!,
    ];
    winnerLines[1] = ellipsize(ctx, winnerLines[1]!, CONTENT_W);
  }
  y += 30 + winnerSize;
  for (const line of winnerLines) {
    ctx.fillText(line, cx, y);
    y += winnerSize * 1.12;
  }

  // --- divider ---
  y += 26;
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, y);
  ctx.lineTo(CARD_W - 120, y);
  ctx.stroke();
  y += 64;

  // --- veto block ---
  if (data.veto) {
    ctx.fillStyle = AMBER;
    ctx.font = font(700, 28);
    tracked(ctx, "VETO", cx, y, 8);
    y += 56;
    const vetoLine = `${data.veto.by} vetoed ${data.veto.candidateName}`;
    const vetoSize = fitSize(ctx, vetoLine, CONTENT_W, 44, 32, 700);
    ctx.font = font(700, vetoSize);
    ctx.fillStyle = TEXT;
    // Single line with ellipsis: veto lines are short in practice, and a
    // wrapped 40-char name would steal the card's vertical budget.
    ctx.fillText(ellipsize(ctx, vetoLine, CONTENT_W), cx, y);
    y += vetoSize * 1.25;
    const reasonSize = fitSize(ctx, data.veto.reason, CONTENT_W, 32, 26, 400);
    ctx.font = font(400, reasonSize);
    ctx.fillStyle = SUBTLE;
    for (const line of wrapLines(ctx, data.veto.reason, CONTENT_W).slice(0, 2)) {
      ctx.fillText(line, cx, y);
      y += reasonSize * 1.3;
    }
    y += 30;
  }

  // --- strongest evidence ---
  ctx.fillStyle = SUBTLE;
  ctx.font = font(700, 28);
  tracked(ctx, "STRONGEST EVIDENCE", cx, y, 8);
  y += 44;

  const rows = data.evidence.slice(0, 2);
  if (rows.length > 0) {
    const rowH = 96;
    const gap = 16;
    for (const row of rows) {
      roundRect(ctx, M, y, CONTENT_W, rowH, 16);
      ctx.fillStyle = PANEL;
      ctx.fill();
      ctx.strokeStyle = HAIRLINE;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = MUTED;
      ctx.font = font(500, 34);
      const label = ellipsize(ctx, row.label, CONTENT_W - 220);
      ctx.fillText(label, M + 36, y + rowH / 2 + 12);

      ctx.textAlign = "right";
      ctx.fillStyle = TEXT;
      ctx.font = font(800, 40);
      ctx.fillText(`${row.pct}%`, M + CONTENT_W - 36, y + rowH / 2 + 14);
      ctx.textAlign = "center";

      y += rowH + gap;
    }
    y += 12;
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = font(500, 34);
    ctx.fillText(data.evidenceFallbackNote, cx, y);
    y += 70;
  }

  // --- tug-of-war bar ---
  const total = Math.max(1, data.scoreA + data.scoreB);
  const aFrac = Math.min(1, Math.max(0, data.scoreA / total));
  const barY = y + 40;
  const barH = 30;

  ctx.textAlign = "left";
  ctx.fillStyle = AMBER;
  ctx.font = font(700, 30);
  ctx.fillText(ellipsize(ctx, data.candidateAName, 380), M, barY - 18);
  ctx.textAlign = "right";
  ctx.fillStyle = TEAL;
  ctx.fillText(
    ellipsize(ctx, data.candidateBName, 380),
    M + CONTENT_W,
    barY - 18
  );
  ctx.textAlign = "center";

  roundRect(ctx, M, barY, CONTENT_W, barH, 15);
  ctx.fillStyle = TRACK;
  ctx.fill();
  if (aFrac > 0.005) {
    const aw = Math.round(CONTENT_W * aFrac);
    // amber segment with left-rounded corners
    ctx.save();
    roundRect(ctx, M, barY, CONTENT_W, barH, 15);
    ctx.clip();
    ctx.fillStyle = AMBER;
    ctx.fillRect(M, barY, aw, barH);
    ctx.restore();
    if (aFrac < 0.995) {
      // teal segment with right-rounded corners
      ctx.save();
      roundRect(ctx, M, barY, CONTENT_W, barH, 15);
      ctx.clip();
      ctx.fillStyle = TEAL;
      ctx.fillRect(M + aw, barY, CONTENT_W - aw, barH);
      ctx.restore();
    }
  } else {
    roundRect(ctx, M, barY, CONTENT_W, barH, 15);
    ctx.fillStyle = TEAL;
    ctx.fill();
  }
  // score labels under the bar
  ctx.font = font(700, 30);
  ctx.textAlign = "left";
  ctx.fillStyle = AMBER;
  ctx.fillText(`${Math.round(data.scoreA)}`, M, barY + barH + 44);
  ctx.textAlign = "right";
  ctx.fillStyle = TEAL;
  ctx.fillText(`${Math.round(data.scoreB)}`, M + CONTENT_W, barY + barH + 44);
  ctx.textAlign = "center";
  const barEnd = barY + barH + 54;

  // --- footer: below the content, pinned near the bottom when room allows ---
  // Hard cap keeps the host line clear of the frame in pathological cases.
  const fy = Math.min(
    Math.max(barEnd + 56, CARD_H - 150),
    CARD_H - 74 - 66
  );
  ctx.fillStyle = SUBTLE;
  ctx.font = font(500, 30);
  ctx.fillText("Settled by the AI Courtroom", cx, fy);
  ctx.font = font(500, 28);
  ctx.fillStyle = SUBTLE;
  const hostLine = `${data.host} · ${data.dateLabel}`;
  ctx.fillText(ellipsize(ctx, hostLine, CONTENT_W), cx, fy + 48);

  return canvas;
}
