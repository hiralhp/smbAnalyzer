// ─────────────────────────────────────────────────────────────────────────────
// Analysis Pipeline
//
// Orchestrates the full analysis flow for a report:
//   1. Scrape business website
//   2. Scrape competitor websites (if provided)
//   3. Run deterministic scoring engine
//   4. Call LLM once for summary + content asset
//   5. Persist all results to Supabase
//
// This function is called from the API route /api/reports/[id]/process
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { scrapeWebsite } from "@/lib/analysis/scraper";
import { scoreWebsite, generateRecommendations } from "@/lib/analysis/scoring";
import { generateLlmSummary } from "@/lib/analysis/llm-summarizer";
import type {
  ReportFormInput,
  WebsiteAnalysis,
  AnalysisPipelineResult,
} from "@/lib/types";

export async function runAnalysisPipeline(
  reportId: string,
  formInput: ReportFormInput
): Promise<AnalysisPipelineResult> {
  const supabase = createClient();

  // ── Mark report as running ────────────────────────────────────────────────
  await supabase
    .from("reports")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", reportId);

  try {
    // ── Step 1: Scrape business website ────────────────────────────────────
    let websiteAnalysis: WebsiteAnalysis;

    if (formInput.websiteUrl) {
      websiteAnalysis = await scrapeWebsite(formInput.websiteUrl, {
        isCompetitor: false,
      });
    } else {
      // No website provided — create empty analysis
      websiteAnalysis = {
        url: "",
        isCompetitor: false,
        h1Headings: [],
        h2Headings: [],
        internalLinks: [],
        hasServicePages: false,
        hasFaq: false,
        hasLocationMention: false,
        hasTrustSignals: false,
        hasContactInfo: false,
        hasHours: false,
        hasPricing: false,
        hasTestimonials: false,
        fetchError: "No website URL provided",
      };
    }

    // ── Step 2: Scrape competitors ─────────────────────────────────────────
    const competitorAnalyses: WebsiteAnalysis[] = [];
    const competitorUrls = formInput.competitorUrls ?? [];

    for (let i = 0; i < competitorUrls.length; i++) {
      const url = competitorUrls[i];
      if (!url) continue;
      const name = formInput.competitorNames?.[i] ?? `Competitor ${i + 1}`;
      const analysis = await scrapeWebsite(url, {
        isCompetitor: true,
        competitorName: name,
      });
      competitorAnalyses.push(analysis);
    }

    // ── Step 3: Deterministic scoring ──────────────────────────────────────
    const { scores, findings } = scoreWebsite(websiteAnalysis, formInput);
    const recommendations = generateRecommendations(findings, websiteAnalysis);

    // ── Step 4: LLM summary (one call) ─────────────────────────────────────
    const llmSummary = await generateLlmSummary(
      formInput,
      websiteAnalysis,
      scores,
      findings
    );

    // ── Step 5: Persist to Supabase ────────────────────────────────────────

    // 5a. Website analysis
    await supabase.from("website_analyses").upsert({
      report_id: reportId,
      url: websiteAnalysis.url || formInput.websiteUrl || "",
      is_competitor: false,
      title: websiteAnalysis.title,
      meta_description: websiteAnalysis.metaDescription,
      h1_headings: websiteAnalysis.h1Headings,
      h2_headings: websiteAnalysis.h2Headings,
      body_text_sample: websiteAnalysis.bodyTextSample,
      has_service_pages: websiteAnalysis.hasServicePages,
      has_faq: websiteAnalysis.hasFaq,
      has_location_mention: websiteAnalysis.hasLocationMention,
      has_trust_signals: websiteAnalysis.hasTrustSignals,
      has_contact_info: websiteAnalysis.hasContactInfo,
      has_hours: websiteAnalysis.hasHours,
      has_pricing: websiteAnalysis.hasPricing,
      has_testimonials: websiteAnalysis.hasTestimonials,
      internal_links: websiteAnalysis.internalLinks,
      fetch_error: websiteAnalysis.fetchError,
    });

    // 5b. Competitor analyses
    for (const comp of competitorAnalyses) {
      await supabase.from("website_analyses").insert({
        report_id: reportId,
        url: comp.url,
        is_competitor: true,
        competitor_name: comp.competitorName,
        title: comp.title,
        meta_description: comp.metaDescription,
        h1_headings: comp.h1Headings,
        h2_headings: comp.h2Headings,
        body_text_sample: comp.bodyTextSample,
        has_service_pages: comp.hasServicePages,
        has_faq: comp.hasFaq,
        has_location_mention: comp.hasLocationMention,
        has_trust_signals: comp.hasTrustSignals,
        has_contact_info: comp.hasContactInfo,
        has_hours: comp.hasHours,
        has_pricing: comp.hasPricing,
        has_testimonials: comp.hasTestimonials,
        internal_links: comp.internalLinks,
        fetch_error: comp.fetchError,
      });
    }

    // 5c. Scores
    await supabase.from("report_scores").upsert({
      report_id: reportId,
      overall_score: scores.overallScore,
      content_clarity_score: scores.contentClarityScore,
      service_specificity_score: scores.serviceSpecificityScore,
      local_relevance_score: scores.localRelevanceScore,
      trust_signal_score: scores.trustSignalScore,
      faq_discoverability_score: scores.faqDiscoverabilityScore,
    });

    // 5d. Findings
    if (findings.length > 0) {
      await supabase.from("report_findings").delete().eq("report_id", reportId);
      await supabase.from("report_findings").insert(
        findings.map((f) => ({
          report_id: reportId,
          type: f.type,
          category: f.category,
          label: f.label,
          detail: f.detail,
        }))
      );
    }

    // 5e. Recommendations
    if (recommendations.length > 0) {
      await supabase
        .from("report_recommendations")
        .delete()
        .eq("report_id", reportId);
      await supabase.from("report_recommendations").insert(
        recommendations.map((r) => ({
          report_id: reportId,
          priority: r.priority,
          title: r.title,
          description: r.description,
          impact: r.impact,
          effort: r.effort,
        }))
      );
    }

    // 5f. LLM outputs
    await supabase.from("report_llm_outputs").upsert({
      report_id: reportId,
      positioning_summary: llmSummary.positioningSummary,
      top_strengths: llmSummary.topStrengths,
      top_opportunities: llmSummary.topOpportunities,
      content_asset_type: llmSummary.contentAssetType,
      content_asset_draft: llmSummary.contentAssetDraft,
      model_used: process.env.LLM_MODEL ?? "unknown",
    });

    // ── Mark complete ──────────────────────────────────────────────────────
    await supabase
      .from("reports")
      .update({ status: "complete", updated_at: new Date().toISOString() })
      .eq("id", reportId);

    return {
      websiteAnalysis,
      competitorAnalyses,
      scores,
      findings,
      llmSummary,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Report ${reportId} failed:`, message);

    await supabase
      .from("reports")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    throw err;
  }
}
