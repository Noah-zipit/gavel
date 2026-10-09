import Link from "next/link";
import { GavelIcon } from "./components/icons";

// Courtroom-styled 404: this chamber does not exist.
export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-court-bg px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-court-border bg-court-panel">
        <GavelIcon className="h-8 w-8 text-court-gold" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold text-court-text">
        This chamber does not exist
      </h1>
      <p className="mt-3 max-w-md text-court-muted">
        The courtroom you are looking for was never built, or it has been
        adjourned. The AI Courtroom is still in session.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[44px] items-center rounded-md border border-court-border bg-court-panel px-6 py-3 text-court-text hover:border-court-amber"
      >
        Return to the courtroom
      </Link>
    </main>
  );
}
