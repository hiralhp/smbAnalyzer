// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports
// Creates a new report from form input, then triggers async processing
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { runAnalysisPipeline } from "@/lib/analysis/pipeline";
import type { ReportFormInput } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let formInput: ReportFormInput;

  try {
    formInput = (await request.json()) as ReportFormInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validation: require websiteUrl OR (businessName + city)
  const hasUrl = !!formInput.websiteUrl?.trim();
  const hasNameAndCity =
    !!(formInput.businessName?.trim() && formInput.city?.trim());

  if (!hasUrl && !hasNameAndCity) {
    return NextResponse.json(
      {
        error:
          "Provide a website URL, or both a business name and city.",
      },
      { status: 400 }
    );
  }

  const inputMode: "url" | "name_city" = hasUrl ? "url" : "name_city";

  // Derive a placeholder business name from the URL — pipeline will overwrite
  // it with the scraped page title once the website is fetched.
  function domainFromUrl(url: string): string {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`)
        .hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }
  const placeholderName = formInput.businessName?.trim()
    || (formInput.websiteUrl ? domainFromUrl(formInput.websiteUrl.trim()) : "Unknown");

  let supabase;
  try {
    supabase = createClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/reports] Supabase client error:", msg);
    return NextResponse.json(
      { error: `Database configuration error: ${msg}` },
      { status: 500 }
    );
  }

  // 1. Create business record
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({
      name: placeholderName,
      website_url: formInput.websiteUrl?.trim() || null,
      category: formInput.category?.trim() || null,
      city: formInput.city?.trim() || null,
    })
    .select()
    .single();

  if (bizError || !business) {
    const detail = bizError?.message ?? "unknown error";
    const hint = bizError?.hint ? ` Hint: ${bizError.hint}` : "";
    console.error("[POST /api/reports] Business insert error:", bizError);
    return NextResponse.json(
      { error: `Database error: ${detail}${hint}` },
      { status: 500 }
    );
  }

  // 2. Create report record (pending)
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({ business_id: business.id, status: "pending" })
    .select()
    .single();

  if (reportError || !report) {
    const detail = reportError?.message ?? "unknown error";
    console.error("[POST /api/reports] Report insert error:", reportError);
    return NextResponse.json(
      { error: `Database error: ${detail}` },
      { status: 500 }
    );
  }

  // 3. Store report inputs
  await supabase.from("report_inputs").insert({
    report_id: report.id,
    business_name: placeholderName,
    website_url: formInput.websiteUrl?.trim() || null,
    category: formInput.category?.trim() || null,
    city: formInput.city?.trim() || null,
    top_services: formInput.topServices?.filter(Boolean) || null,
    competitor_urls: formInput.competitorUrls?.filter(Boolean) || null,
    competitor_names: formInput.competitorNames?.filter(Boolean) || null,
  });

  // 4. Run pipeline in the background — respond immediately so the client can
  // navigate to the report page and poll for status. waitUntil keeps the
  // function alive for the full maxDuration after the response is sent.
  const reportId = report.id;
  waitUntil(
    runAnalysisPipeline(reportId, formInput, inputMode).catch((err) => {
      console.error("[POST /api/reports] Pipeline error for", reportId, err);
    })
  );

  return NextResponse.json({ reportId }, { status: 201 });
}
