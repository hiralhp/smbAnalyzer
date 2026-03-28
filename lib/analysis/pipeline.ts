// ─────────────────────────────────────────────────────────────────────────────
// Analysis Pipeline
//
// Orchestrates the full analysis flow for a report:
//   1. Scrape business website (if URL provided)
//   2. Classify category (deterministic)
//   3. Extract effective location (deterministic)
//   4. Scrape competitor websites (if provided)
//   5. Run category-aware deterministic scoring
//   6. Generate category-aware recommendations
//   7. Generate deterministic FAQ rows
//   8. Call LLM once for summary + content asset (optional)
//   9. Persist all results to Supabase
//
// LLM is optional and additive — all deterministic outputs persist regardless.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { scrapeWebsite } from "@/lib/analysis/scraper";
import {
  scoreWebsite,
  generateRecommendations,
  generateScoreExplanation,
} from "@/lib/analysis/scoring";
import { generateLlmSummary } from "@/lib/analysis/llm-summarizer";
import { computeQueryCoverage } from "@/lib/analysis/query-coverage";
import { classifyCategory } from "@/lib/analysis/category-classifier";
import { extractLocation } from "@/lib/analysis/location-extractor";
import { generateFaqs } from "@/lib/analysis/faq-generator";
import { inferBusinessFeatures } from "@/lib/analysis/business-features";
import type {
  ReportFormInput,
  WebsiteAnalysis,
  AnalysisPipelineResult,
  ReportSignal,
  ScoreExplanation,
} from "@/lib/types";

// ── Keyword extraction helpers ────────────────────────────────────────────────

const LOCATION_INDICATORS = [
  "serving", "located", "based in", "near", "in", "at", "from",
];

function extractLocationTerms(analysis: WebsiteAnalysis, city: string): string[] {
  const terms: string[] = [];
  const text = [analysis.title, ...(analysis.h1Headings ?? [])].join(" ");
  const lower = text.toLowerCase();

  if (city && lower.includes(city.toLowerCase())) {
    terms.push(city);
  }

  const cityStateMatches = text.match(/\b[A-Z][a-z]{2,},\s*[A-Z]{2}\b/g) ?? [];
  for (const m of cityStateMatches) {
    if (!terms.includes(m)) terms.push(m);
  }

  for (const indicator of LOCATION_INDICATORS) {
    if (lower.includes(indicator)) {
      terms.push(indicator);
      break;
    }
  }

  return [...new Set(terms)];
}

function extractServiceTerms(
  analysis: WebsiteAnalysis,
  topServices: string[]
): string[] {
  const text = [
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    analysis.bodyTextSample ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return topServices.filter((s) => text.includes(s.toLowerCase()));
}

function buildKeywordCounts(analysis: WebsiteAnalysis): Record<string, number> {
  const text = [
    analysis.title ?? "",
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    analysis.bodyTextSample ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const words = text.split(/\s+/).filter((w) => w.length >= 4);
  const stopWords = new Set([
    "that", "this", "with", "from", "have", "been", "will", "your",
    "more", "they", "what", "when", "here", "about", "their", "there",
    "just", "also", "into", "than", "then", "them", "were", "some",
  ]);

  const counts: Record<string, number> = {};
  for (const word of words) {
    if (!stopWords.has(word)) {
      counts[word] = (counts[word] ?? 0) + 1;
    }
  }

  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
  );
}

function buildEvidenceSnapshot(analysis: WebsiteAnalysis): Record<string, unknown> {
  return {
    title: analysis.title,
    metaDescription: analysis.metaDescription,
    h1Count: analysis.h1Headings.length,
    h2Count: analysis.h2Headings.length,
    h1Sample: analysis.h1Headings.slice(0, 2),
    h2Sample: analysis.h2Headings.slice(0, 3),
    hasServicePages: analysis.hasServicePages,
    hasFaq: analysis.hasFaq,
    hasLocationMention: analysis.hasLocationMention,
    hasContactInfo: analysis.hasContactInfo,
    hasTrustSignals: analysis.hasTrustSignals,
    hasHours: analysis.hasHours,
    hasPricing: analysis.hasPricing,
    hasTestimonials: analysis.hasTestimonials,
    fetchError: analysis.fetchError,
  };
}

function detectPageType(analysis: WebsiteAnalysis): string {
  if (analysis.isCompetitor) return "competitor_homepage";
  const urlLower = analysis.url.toLowerCase();
  if (urlLower.match(/\/(faq|questions|help)/)) return "faq";
  if (urlLower.match(/\/(contact|about)/)) return "contact";
  if (urlLower.match(/\/(services?|solutions?|work)/)) return "service_page";
  return "homepage";
}

function buildSignalRows(
  analysis: WebsiteAnalysis,
  city: string
): ReportSignal[] {
  return [
    {
      signalName: "has_title",
      signalValue: analysis.title ? "true" : "false",
      signalType: "boolean",
      confidence: "high",
      evidence: analysis.title
        ? `Title found: "${analysis.title}"`
        : "No <title> tag detected.",
    },
    {
      signalName: "has_meta_description",
      signalValue: analysis.metaDescription ? "true" : "false",
      signalType: "boolean",
      confidence: "high",
      evidence: analysis.metaDescription
        ? `Meta description: "${analysis.metaDescription.slice(0, 80)}"`
        : "No meta description found.",
    },
    {
      signalName: "h1_count",
      signalValue: String(analysis.h1Headings.length),
      signalType: "count",
      confidence: "high",
      evidence: analysis.h1Headings.length > 0
        ? `${analysis.h1Headings.length} H1 heading(s) found.`
        : "No H1 elements found.",
    },
    {
      signalName: "h2_count",
      signalValue: String(analysis.h2Headings.length),
      signalType: "count",
      confidence: "high",
      evidence: `${analysis.h2Headings.length} H2 headings found.`,
    },
    {
      signalName: "has_faq",
      signalValue: String(analysis.hasFaq),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasFaq
        ? 'FAQ-related content detected.'
        : 'No FAQ-like sections detected.',
    },
    {
      signalName: "has_service_pages",
      signalValue: String(analysis.hasServicePages),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasServicePages
        ? "Service-oriented navigation links found."
        : "No service-specific navigation links found.",
    },
    {
      signalName: "has_contact_info",
      signalValue: String(analysis.hasContactInfo),
      signalType: "boolean",
      confidence: "high",
      evidence: analysis.hasContactInfo
        ? "Phone or email pattern detected."
        : "No phone number or email address found.",
    },
    {
      signalName: "has_trust_signals",
      signalValue: String(analysis.hasTrustSignals),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasTrustSignals
        ? 'Credential language found.'
        : "No credential or certification language found.",
    },
    {
      signalName: "has_testimonials",
      signalValue: String(analysis.hasTestimonials),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasTestimonials
        ? "Review or testimonial content detected."
        : "No testimonial or review content found.",
    },
    {
      signalName: "has_location_mention",
      signalValue: String(analysis.hasLocationMention),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasLocationMention
        ? "Location language found in title or H1."
        : "No location language found in prominent positions.",
    },
    {
      signalName: "has_hours",
      signalValue: String(analysis.hasHours),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasHours
        ? 'Hours-related content detected.'
        : "No business hours detected.",
    },
    {
      signalName: "has_pricing",
      signalValue: String(analysis.hasPricing),
      signalType: "boolean",
      confidence: "medium",
      evidence: analysis.hasPricing
        ? 'Pricing language detected.'
        : "No pricing language found.",
    },
    {
      signalName: "location_in_title",
      signalValue: city && (analysis.title ?? "").toLowerCase().includes(city.toLowerCase())
        ? "true"
        : "false",
      signalType: "boolean",
      confidence: city ? "high" : "low",
      evidence: city
        ? (analysis.title ?? "").toLowerCase().includes(city.toLowerCase())
          ? `"${city}" found in title.`
          : `"${city}" not found in page title.`
        : "No city available.",
    },
  ];
}

// ── Main pipeline ────────────────────────────────────────────────────────────

export async function runAnalysisPipeline(
  reportId: string,
  formInput: ReportFormInput,
  inputMode: "url" | "name_city" = "url"
): Promise<AnalysisPipelineResult> {
  const supabase = createClient();

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
        fetchError: "no_url_provided",
      };
    }

    // ── Step 1b: Infer business features (deterministic) ───────────────────
    const businessFeatures = inferBusinessFeatures(websiteAnalysis);

    // ── Step 2: Update business name from scraped title ────────────────────
    let inferredName: string | undefined;
    if (!formInput.businessName && websiteAnalysis.title) {
      inferredName = websiteAnalysis.title;
      await supabase
        .from("businesses")
        .update({ name: websiteAnalysis.title })
        .eq(
          "id",
          (
            await supabase
              .from("reports")
              .select("business_id")
              .eq("id", reportId)
              .single()
          ).data?.business_id
        );
    }

    // ── Step 3: Category classification ────────────────────────────────────
    const categoryResult = classifyCategory(formInput.category, websiteAnalysis);
    const { canonicalCategory } = categoryResult;

    // ── Step 4: Location extraction ─────────────────────────────────────────
    const locationResult = extractLocation(formInput.city, websiteAnalysis);
    const effectiveCity = locationResult?.city ?? "";
    const citySource = locationResult?.source ?? "user_input";

    // Build effective form input with inferred city for scoring/queries
    const effectiveFormInput: ReportFormInput = {
      ...formInput,
      city: effectiveCity,
    };

    // ── Step 5: Store canonical competitors + scrape them ──────────────────
    const competitorAnalyses: WebsiteAnalysis[] = [];
    const competitorUrls = formInput.competitorUrls ?? [];
    const competitorIdMap: Record<string, string> = {};

    for (let i = 0; i < competitorUrls.length; i++) {
      const url = competitorUrls[i];
      if (!url) continue;

      const analysis = await scrapeWebsite(url, { isCompetitor: true });
      const name =
        formInput.competitorNames?.[i] ||
        analysis.title ||
        url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
      analysis.competitorName = name;
      competitorAnalyses.push(analysis);

      const { data: compRecord } = await supabase
        .from("report_competitors")
        .insert({
          report_id: reportId,
          name,
          website_url: analysis.url,
          source: "user_provided",
        })
        .select("id")
        .single();

      if (compRecord?.id) {
        competitorIdMap[analysis.url] = compRecord.id;
      }
    }

    // ── Step 6: Category-aware deterministic scoring ────────────────────────
    const { scores, findings } = scoreWebsite(
      websiteAnalysis,
      effectiveFormInput,
      canonicalCategory,
      businessFeatures
    );
    const recommendations = generateRecommendations(
      findings,
      websiteAnalysis,
      canonicalCategory,
      businessFeatures
    );
    const scoreExplanation: ScoreExplanation = generateScoreExplanation(scores, findings);

    // ── Step 7: LLM summary (one optional call) ─────────────────────────────
    const llmSummary = await generateLlmSummary(
      effectiveFormInput,
      websiteAnalysis,
      scores,
      findings
    );

    // ── Step 8: Compute enriched metadata ───────────────────────────────────
    const services = formInput.topServices ?? [];
    const detectedLocationTerms = extractLocationTerms(websiteAnalysis, effectiveCity);
    const detectedServiceTerms = extractServiceTerms(websiteAnalysis, services);
    const keywordCounts = buildKeywordCounts(websiteAnalysis);
    const scannedPageType = detectPageType(websiteAnalysis);
    const evidenceSnapshot = buildEvidenceSnapshot(websiteAnalysis);

    // ── Step 9: Query coverage (using inferred city + canonical category) ───
    const queryCoverageRows = computeQueryCoverage(
      websiteAnalysis,
      canonicalCategory,
      effectiveCity,
      services
    );

    // ── Step 10: Signal rows ─────────────────────────────────────────────────
    const signalRows = buildSignalRows(websiteAnalysis, effectiveCity);

    // ── Step 11: Deterministic FAQ ───────────────────────────────────────────
    const faqRows = generateFaqs(canonicalCategory);

    // ── Step 12: Persist to Supabase ─────────────────────────────────────────

    // 12a. Website analysis (primary) with enriched metadata
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
      detected_location_terms: detectedLocationTerms,
      detected_service_terms: detectedServiceTerms,
      keyword_counts: keywordCounts,
      scanned_page_type: scannedPageType,
      evidence_snapshot: evidenceSnapshot,
      business_features: businessFeatures,
    });

    // 12b. Competitor analyses
    for (const comp of competitorAnalyses) {
      const competitorId = competitorIdMap[comp.url];
      await supabase.from("website_analyses").insert({
        report_id: reportId,
        url: comp.url,
        is_competitor: true,
        competitor_name: comp.competitorName,
        competitor_id: competitorId ?? null,
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
        scanned_page_type: "competitor_homepage",
        evidence_snapshot: buildEvidenceSnapshot(comp),
        detected_service_terms: extractServiceTerms(comp, services),
        keyword_counts: buildKeywordCounts(comp),
      });
    }

    // 12c. Scores with explanation
    await supabase.from("report_scores").upsert({
      report_id: reportId,
      overall_score: scores.overallScore,
      content_clarity_score: scores.contentClarityScore,
      service_specificity_score: scores.serviceSpecificityScore,
      local_relevance_score: scores.localRelevanceScore,
      trust_signal_score: scores.trustSignalScore,
      faq_discoverability_score: scores.faqDiscoverabilityScore,
      explanation: {
        overall: scoreExplanation.overall,
        content_clarity: scoreExplanation.contentClarity,
        service_specificity: scoreExplanation.serviceSpecificity,
        local_relevance: scoreExplanation.localRelevance,
        trust_signals: scoreExplanation.trustSignals,
        faq_discoverability: scoreExplanation.faqDiscoverability,
      },
    });

    // 12d. Findings with evidence metadata
    if (findings.length > 0) {
      await supabase.from("report_findings").delete().eq("report_id", reportId);
      await supabase.from("report_findings").insert(
        findings.map((f) => ({
          report_id: reportId,
          type: f.type,
          category: f.category,
          label: f.label,
          detail: f.detail,
          confidence: f.confidence ?? null,
          evidence: f.evidence ?? null,
          source_signal: f.sourceSignal ?? null,
          source_url: websiteAnalysis.url || null,
          rule_id: f.ruleId ?? null,
        }))
      );
    }

    // 12e. Recommendations
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

    // 12f. LLM outputs
    await supabase.from("report_llm_outputs").upsert({
      report_id: reportId,
      positioning_summary: llmSummary.positioningSummary,
      top_strengths: llmSummary.topStrengths,
      top_opportunities: llmSummary.topOpportunities,
      content_asset_type: llmSummary.contentAssetType,
      content_asset_draft: llmSummary.contentAssetDraft,
      model_used: process.env.LLM_MODEL ?? "unknown",
    });

    // 12g. Signals
    await supabase.from("report_signals").delete().eq("report_id", reportId);
    if (signalRows.length > 0) {
      await supabase.from("report_signals").insert(
        signalRows.map((s) => ({
          report_id: reportId,
          signal_name: s.signalName,
          signal_value: s.signalValue,
          signal_type: s.signalType,
          confidence: s.confidence ?? null,
          evidence: s.evidence ?? null,
          source_url: websiteAnalysis.url || null,
        }))
      );
    }

    // 12h. Query coverage
    await supabase
      .from("report_query_coverage")
      .delete()
      .eq("report_id", reportId);
    if (queryCoverageRows.length > 0) {
      await supabase.from("report_query_coverage").insert(
        queryCoverageRows.map((q) => ({
          report_id: reportId,
          query: q.query,
          query_type: q.queryType ?? null,
          coverage: q.coverage,
          missing_terms: q.missingTerms,
          matched_terms: q.matchedTerms,
          title_match: q.titleMatch,
          heading_match: q.headingMatch,
          body_match: q.bodyMatch,
          service_page_match: q.servicePageMatch,
        }))
      );
    }

    // 12i. Deterministic FAQs
    await supabase.from("report_faqs").delete().eq("report_id", reportId);
    if (faqRows.length > 0) {
      await supabase.from("report_faqs").insert(
        faqRows.map((f) => ({
          report_id: reportId,
          question: f.question,
          answer: f.answer ?? null,
          category: f.category,
          source: f.source,
          sort_order: f.sortOrder ?? 0,
        }))
      );
    }

    // 12j. Inference record
    await supabase.from("report_inference").upsert({
      report_id: reportId,
      input_mode: inputMode,
      inferred_name: inferredName ?? null,
      inferred_city: locationResult && locationResult.source !== "user_input"
        ? locationResult.city
        : null,
      city_source: citySource,
      canonical_category: canonicalCategory,
      category_confidence: categoryResult.confidence,
      category_evidence: categoryResult.evidence,
      inferred_services: detectedServiceTerms.length > 0 ? detectedServiceTerms : null,
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
