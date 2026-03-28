// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/[id]
// Fetches a fully-assembled report for the report page
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Report, WebsiteSignalSummary, CompetitorSignalSummary } from "@/lib/types";

// Never cache — this route is polled for live status updates
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = createClient();

  // Fetch report + business in one query
  const { data: reportRow, error: reportError } = await supabase
    .from("reports")
    .select(
      `
      id, status, error_message, created_at,
      businesses (name, website_url, category, city)
    `
    )
    .eq("id", id)
    .single();

  if (reportError || !reportRow) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const business = Array.isArray(reportRow.businesses)
    ? reportRow.businesses[0]
    : reportRow.businesses;

  const report: Report = {
    id: reportRow.id,
    status: reportRow.status as Report["status"],
    errorMessage: reportRow.error_message ?? undefined,
    createdAt: reportRow.created_at,
    business: {
      name: business?.name ?? "Unknown",
      websiteUrl: business?.website_url ?? undefined,
      category: business?.category ?? undefined,
      city: business?.city ?? undefined,
    },
  };

  // Only fetch detail data if report is complete
  if (reportRow.status === "complete") {
    // Scores
    const { data: scores } = await supabase
      .from("report_scores")
      .select("*")
      .eq("report_id", id)
      .single();

    if (scores) {
      report.scores = {
        overallScore: scores.overall_score,
        contentClarityScore: scores.content_clarity_score,
        serviceSpecificityScore: scores.service_specificity_score,
        localRelevanceScore: scores.local_relevance_score,
        trustSignalScore: scores.trust_signal_score,
        faqDiscoverabilityScore: scores.faq_discoverability_score,
      };
    }

    // Findings
    const { data: findings } = await supabase
      .from("report_findings")
      .select("*")
      .eq("report_id", id)
      .order("type");

    if (findings) {
      report.findings = findings.map((f) => ({
        type: f.type as "strength" | "gap" | "signal",
        category: f.category as Report["findings"] extends Array<infer T>
          ? T["category"]
          : never,
        label: f.label,
        detail: f.detail ?? undefined,
      }));
    }

    // Recommendations
    const { data: recs } = await supabase
      .from("report_recommendations")
      .select("*")
      .eq("report_id", id)
      .order("priority");

    if (recs) {
      report.recommendations = recs.map((r) => ({
        priority: r.priority,
        title: r.title,
        description: r.description,
        impact: r.impact as "high" | "medium" | "low",
        effort: r.effort as "high" | "medium" | "low",
        contentDraft: r.content_draft ?? undefined,
      }));
    }

    // LLM outputs
    const { data: llm } = await supabase
      .from("report_llm_outputs")
      .select("*")
      .eq("report_id", id)
      .single();

    if (llm) {
      report.llmOutput = {
        positioningSummary: llm.positioning_summary ?? undefined,
        topStrengths: llm.top_strengths ?? undefined,
        topOpportunities: llm.top_opportunities ?? undefined,
        contentAssetType: llm.content_asset_type as Report["llmOutput"] extends object
          ? NonNullable<Report["llmOutput"]>["contentAssetType"]
          : never,
        contentAssetDraft: llm.content_asset_draft ?? undefined,
        modelUsed: llm.model_used ?? undefined,
      };
    }

    // Website signals (primary — non-competitor)
    const { data: websiteAnalysis } = await supabase
      .from("website_analyses")
      .select("*")
      .eq("report_id", id)
      .eq("is_competitor", false)
      .single();

    // Competitor analyses
    const { data: competitorRows } = await supabase
      .from("website_analyses")
      .select("*")
      .eq("report_id", id)
      .eq("is_competitor", true)
      .order("fetched_at");

    if (competitorRows?.length) {
      report.competitorSignals = competitorRows.map(
        (c): CompetitorSignalSummary => ({
          name: c.competitor_name ?? c.url,
          url: c.url,
          fetchError: c.fetch_error ?? undefined,
          hasServicePages: c.has_service_pages ?? false,
          hasFaq: c.has_faq ?? false,
          hasLocationMention: c.has_location_mention ?? false,
          hasTrustSignals: c.has_trust_signals ?? false,
          hasContactInfo: c.has_contact_info ?? false,
          hasHours: c.has_hours ?? false,
          hasPricing: c.has_pricing ?? false,
          hasTestimonials: c.has_testimonials ?? false,
        })
      );
    }

    if (websiteAnalysis) {
      const signals: WebsiteSignalSummary = {
        url: websiteAnalysis.url,
        title: websiteAnalysis.title ?? undefined,
        metaDescription: websiteAnalysis.meta_description ?? undefined,
        h1Headings: websiteAnalysis.h1_headings ?? [],
        h2Headings: websiteAnalysis.h2_headings ?? [],
        hasServicePages: websiteAnalysis.has_service_pages ?? false,
        hasFaq: websiteAnalysis.has_faq ?? false,
        hasLocationMention: websiteAnalysis.has_location_mention ?? false,
        hasTrustSignals: websiteAnalysis.has_trust_signals ?? false,
        hasContactInfo: websiteAnalysis.has_contact_info ?? false,
        hasHours: websiteAnalysis.has_hours ?? false,
        hasPricing: websiteAnalysis.has_pricing ?? false,
        hasTestimonials: websiteAnalysis.has_testimonials ?? false,
        fetchError: websiteAnalysis.fetch_error ?? undefined,
      };
      report.websiteSignals = signals;
    }
  }

  return NextResponse.json(report);
}
