"use client";

interface TugOfWarProps {
  /** 0-100 lean for Advocate A */
  a: number;
  /** 0-100 lean for Advocate B */
  b: number;
  /** signed swing: positive favors A, negative favors B */
  delta: number;
  reason: string;
}

export default function TugOfWar({ a, b, delta, reason }: TugOfWarProps) {
  const total = a + b > 0 ? a + b : 1;
  const pctA = Math.min(100, Math.max(0, (a / total) * 100));
  const swing =
    delta > 0.5 ? "SWINGING LEFT" : delta < -0.5 ? "SWINGING RIGHT" : "EVEN";

  return (
    <div className="w-full" aria-label="Tug-of-war score">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold tracking-[0.14em]">
        <span className="text-court-muted">TUG-OF-WAR</span>
        <span
          className={
            delta > 0.5
              ? "text-court-amber"
              : delta < -0.5
                ? "text-court-teal"
                : "text-court-muted"
          }
        >
          {swing}
        </span>
      </div>

      <div
        className="relative h-3.5 overflow-visible rounded bg-court-border"
        role="meter"
        aria-label="Debate lean between the two advocates"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pctA)}
        aria-valuetext={`${Math.round(pctA)} percent toward Advocate A`}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-l bg-court-amber transition-[width] duration-700 ease-out"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full rounded-r bg-court-teal transition-[width] duration-700 ease-out"
          style={{ width: `${100 - pctA}%` }}
        />
        <div
          className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-court-bg bg-court-text shadow transition-[left] duration-700 ease-out"
          style={{ left: `${pctA}%` }}
          aria-hidden="true"
        />
      </div>

      {reason ? (
        <p className="mt-2.5 text-sm text-court-muted">{reason}</p>
      ) : (
        <p className="mt-2.5 text-sm text-court-muted">
          The meter moves as the advocates land arguments.
        </p>
      )}
    </div>
  );
}
