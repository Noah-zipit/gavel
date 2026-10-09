"use client";

import { GavelIcon } from "./icons";

interface HeaderProps {
  live: boolean;
}

export default function Header({ live }: HeaderProps) {
  return (
    <header className="border-b border-court-border bg-court-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <GavelIcon className="h-8 w-8 shrink-0 text-court-amber" />
          <p className="text-lg font-bold tracking-[0.18em]">
            <span className="text-court-amber">AI</span>{" "}
            <span className="text-court-muted">COURTROOM</span>
          </p>
        </div>

        <h1 className="order-3 w-full text-center text-xl font-bold text-court-text sm:order-2 sm:w-auto sm:flex-1 sm:text-2xl">
          Where do 4 friends eat Friday night?
        </h1>

        <div className="order-2 ml-auto sm:order-3 sm:ml-0">
          {live ? (
            <span
              className="inline-flex items-center gap-2 rounded border border-court-live px-3 py-1.5 text-sm font-bold tracking-[0.18em] text-court-live"
              role="status"
              aria-label="Live: the debate is streaming"
            >
              <span className="live-dot inline-block h-2.5 w-2.5 rounded-full bg-court-live" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center rounded border border-court-border px-3 py-1.5 text-sm font-bold tracking-[0.18em] text-court-muted">
              STANDBY
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
