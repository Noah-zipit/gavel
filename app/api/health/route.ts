// GET /api/health -> { status, evidence } — no key material, ever.

import { isRealQlooConfigured } from "@/lib/evidence";

export async function GET() {
  return Response.json({
    status: "ok",
    evidence: isRealQlooConfigured() ? "real-qloo" : "mock",
  });
}
