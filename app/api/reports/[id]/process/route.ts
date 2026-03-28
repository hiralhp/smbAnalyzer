// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports/[id]/process
//
// Internal endpoint called fire-and-forget after report creation.
// Runs the full analysis pipeline and persists results.
//
// This runs in its own HTTP request so it can exceed the 30s Vercel limit
// on hobby plans (TODO: move to a queue or Edge Function for production).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analysis/pipeline";
import type { ReportFormInput } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let formInput: ReportFormInput;
  try {
    formInput = (await request.json()) as ReportFormInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Run pipeline — errors are caught inside and stored in the DB
  try {
    await runAnalysisPipeline(id, formInput);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/reports/${id}/process] Pipeline error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allow longer execution time for the processing route
export const maxDuration = 60; // seconds (Vercel Pro/hobby)
