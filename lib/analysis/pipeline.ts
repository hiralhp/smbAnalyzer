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
//   8. Call LLM once for base summary (optional)
//   8a–c. Grok enhancement layer (non-blocking, best-effort)
//   9. Persist all results to Supabase
//
// Both LLM and Grok are optional and additive — deterministic outputs always persist.
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
import { classifyArchetype } from "@/lib/analysis/archetype-classifier";
import { classifyBusinessProfile } from "@/lib/analysis/business-profile-classifier";
import { detectWebsitePattern } from "@/lib/analysis/website-pattern-detector";
import { refineBusinessModelWithLlm } from "@/lib/analysis/business-model-refiner";
import { extractLocation } from "@/lib/analysis/location-extractor";
import { getLlmProviderForRequest } from "@/lib/llm";
import { isGroqQuotaError } from "@/lib/errors";
import { buildFallbackSummary } from "@/lib/analysis/llm-summarizer";
import { refineFoodSubtype } from "@/lib/analysis/groq-classifier";
import { scoreContentQualityWithLlm } from "@/lib/analysis/content-quality-scorer";
import { enhanceQueryCoverageWithSemantics } from "@/lib/analysis/semantic-query-enhancer";
import { compareWithCompetitors } from "@/lib/analysis/competitor-comparator";
import { explainVisibilityGaps } from "@/lib/analysis/visibility-explainer";
import { generateFaqs, buildFaqDraft } from "@/lib/analysis/faq-generator";
import { extractBusinessName } from "@/lib/analysis/business-name-extractor";
import { inferBusinessFeatures } from "@/lib/analysis/business-features";
import { enhanceWithGrok } from "@/lib/analysis/grok-enhancer";
import { extractSignalsWithLlm } from "@/lib/analysis/signal-extractor";
import { classifyWithGroq } from "@/lib/analysis/groq-classifier";
import { discoverCompetitorsWithGrok } from "@/lib/analysis/competitor-discoverer";
import { simulateVisibility } from "@/lib/analysis/visibility-simulator";
import { crawlSiteForEvidence } from "@/lib/analysis/site-crawler";
import { inferWebsiteUrl, buildYelpSearchUrl } from "@/lib/analysis/website-inferrer";
import type {
  ReportFormInput,
  WebsiteAnalysis,
  AnalysisPipelineResult,
  ReportSignal,
  ScoreExplanation,
  ArchetypeClassification,
  GrokEnhancementInput,
  GrokEnhancement,
  LlmExtractedSignals,
  LlmReportSummary,
  VisibilitySimulationResult,
  VisibilitySimulationRow,
  GroqClassificationResult,
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

  return Array.from(new Set(terms));
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

function buildEvidenceSnapshot(analysis: WebsiteAnalysis, pagesScanned = 1): Record<string, unknown> {
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
    pagesScanned,
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
  const llmProvider = getLlmProviderForRequest(formInput.userApiKey);
  let quotaLimitHit = false;

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
      // No URL provided — try Grok to find the official website, then fall back
      // to a Yelp search page which gives hours, address, and review signals.
      const nameForInference = formInput.businessName?.trim() ?? "";
      const cityForInference = formInput.city?.trim() ?? "";
      let resolvedUrl: string | null = null;

      if (nameForInference) {
        try {
          resolvedUrl = await inferWebsiteUrl(nameForInference, cityForInference);
        } catch (err) {
          console.warn("[Pipeline] Website inference threw:", err);
        }
      }

      if (resolvedUrl) {
        console.log("[Pipeline] No-URL mode: using inferred website:", resolvedUrl);
        websiteAnalysis = await scrapeWebsite(resolvedUrl, { isCompetitor: false });
      } else if (nameForInference && cityForInference) {
        // Yelp search page — contains address, hours, and category signals
        const yelpUrl = buildYelpSearchUrl(nameForInference, cityForInference);
        console.log("[Pipeline] No-URL mode: Yelp search fallback:", yelpUrl);
        websiteAnalysis = await scrapeWebsite(yelpUrl, { isCompetitor: false });
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
    }

    // ── Step 1a: Multi-page crawl ───────────────────────────────────────────
    // Fetch high-value sub-pages (services, faq, about, contact) and merge
    // their signals into the homepage analysis for richer coverage evidence.
    let pagesScanned = 1;
    if (!websiteAnalysis.fetchError && websiteAnalysis.internalLinks.length > 0) {
      try {
        const { merged, pagesScanned: n } = await crawlSiteForEvidence(websiteAnalysis);
        websiteAnalysis = merged;
        pagesScanned = n;
        console.log(`[Pipeline] Step 1a: crawled ${pagesScanned} pages total`);
      } catch (err) {
        console.warn("[Pipeline] Step 1a crawl failed:", err);
      }
    }

    // ── Step 1b: Infer business features (deterministic) ───────────────────
    const businessFeatures = inferBusinessFeatures(websiteAnalysis);

    // ── Step 1c: Classify multi-dimensional business profile ───────────────
    let businessProfile = classifyBusinessProfile(
      formInput.category,
      websiteAnalysis,
      businessFeatures
    );

    // ── Step 1.4: Groq category classification (non-blocking, best-effort) ───
    // Fast sector/subtype validation before pattern detection.
    // Overrides deterministic sector when Groq has higher confidence.
    let groqClassification: GroqClassificationResult | null = null;
    try {
      groqClassification = await classifyWithGroq(
        formInput.businessName ?? "",
        formInput.category ?? null,
        formInput.city ?? null,
        websiteAnalysis,
        llmProvider
      );
      if (groqClassification && groqClassification.sector !== "unknown") {
        const shouldOverride =
          groqClassification.confidence === "high" ||
          (groqClassification.confidence === "medium" && businessProfile.confidence === "low");
        if (shouldOverride) {
          const prevSector = businessProfile.sector;
          businessProfile.sector = groqClassification.sector;
          // Only adopt subtype when high confidence AND it's not cross-sector
          if (
            groqClassification.subtype &&
            groqClassification.confidence === "high"
          ) {
            businessProfile.subtype = groqClassification.subtype;
          }
          if (prevSector !== businessProfile.sector) {
            console.log(
              `[Pipeline] Groq classification: sector ${prevSector} → ${businessProfile.sector}`,
              `(${groqClassification.confidence}) — "${groqClassification.reasoning}"`
            );
          }
        }
      }
    } catch (err) {
      if (isGroqQuotaError(err)) quotaLimitHit = true;
      console.warn("[Pipeline] Groq classification threw unexpectedly:", err);
    }

    // ── Step 1.4b: Food & beverage subtype refinement (userApiKey only) ─────
    if (formInput.userApiKey && businessProfile.sector === "food_and_beverage") {
      try {
        const refinedSubtype = await refineFoodSubtype(
          effectiveFormInput.businessName ?? inferredName ?? "",
          websiteAnalysis,
          llmProvider
        );
        if (refinedSubtype) {
          console.log(`[Pipeline] Food subtype refined: ${businessProfile.subtype} → ${refinedSubtype}`);
          businessProfile.subtype = refinedSubtype;
        }
      } catch (err) {
        if (isGroqQuotaError(err)) quotaLimitHit = true;
        console.warn("[Pipeline] Food subtype refinement threw unexpectedly:", err);
      }
    }

    // ── Step 1.5: LLM signal extraction (non-blocking, best-effort) ────────
    // Supplements the deterministic scraper signals for pattern routing only.
    // Returns null when MOCK_LLM=true or LLM call fails.
    let llmSignals: LlmExtractedSignals | null = null;
    try {
      llmSignals = await extractSignalsWithLlm(websiteAnalysis, llmProvider);
    } catch (err) {
      if (isGroqQuotaError(err)) quotaLimitHit = true;
      console.warn("[Pipeline] Signal extraction threw unexpectedly:", err);
    }

    // ── Step 1d: Detect website pattern (locked — no downstream overrides) ───
    businessProfile.website_pattern = detectWebsitePattern(
      websiteAnalysis,
      businessProfile,
      businessFeatures,
      llmSignals
    );

    // ── Step 1e: LLM fallback for unknown low-confidence business model ────
    if (businessProfile.business_model === "unknown" && businessProfile.confidence === "low") {
      try {
        businessProfile = await refineBusinessModelWithLlm(
          businessProfile,
          websiteAnalysis,
          llmProvider
        );
      } catch {
        // Provider unavailable — continue with unknown model
      }
    }

    // ── Step 2: Update business name from scraped content ─────────────────
    let inferredName: string | undefined;
    if (!formInput.businessName) {
      inferredName = extractBusinessName(websiteAnalysis);
      if (inferredName) {
        await supabase
          .from("businesses")
          .update({ name: inferredName })
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
    }

    // ── Step 3: Archetype classification (two-level) ────────────────────────
    const archetypeResult: ArchetypeClassification = classifyArchetype(
      formInput.category,
      websiteAnalysis
    );
    const { archetype, archetypeConfidence, subtype, subtypeConfidence } = archetypeResult;

    // ── Step 4: Location extraction ─────────────────────────────────────────
    const locationResult = extractLocation(formInput.city, websiteAnalysis);
    const effectiveCity = locationResult?.city ?? "";
    const citySource = locationResult?.source ?? "user_input";

    // Build effective form input with inferred city for scoring/queries
    const effectiveFormInput: ReportFormInput = {
      ...formInput,
      city: effectiveCity,
    };

    // ── Step 3b: Grok competitor discovery (non-blocking, best-effort) ──────
    // Runs after location is resolved so effectiveCity is available.
    // Discovered competitors are stored with source="auto_discovered" and are
    // not scraped in this pipeline run.
    const knownCompetitorDomains = (formInput.competitorUrls ?? []).map((u) => {
      try {
        return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
      } catch {
        return u.toLowerCase().replace(/^www\./, "");
      }
    });
    try {
      const discoveredCompetitors = await discoverCompetitorsWithGrok({
        businessName: formInput.businessName || "",
        category: formInput.category ?? null,
        city: effectiveCity,
        websiteUrl: formInput.websiteUrl,
        knownCompetitorDomains,
      }, llmProvider);
      if (discoveredCompetitors.length > 0) {
        await supabase.from("report_competitors").insert(
          discoveredCompetitors.map((c) => ({
            report_id: reportId,
            name: c.name,
            website_url: `https://${c.domain}`,
            source: "auto_discovered",
          }))
        );
      }
    } catch (err) {
      if (isGroqQuotaError(err)) quotaLimitHit = true;
      console.warn("[Pipeline] Competitor discovery threw unexpectedly:", err);
    }

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

    // ── Step 5b: Competitor comparison notes (userApiKey only) ───────────────
    if (formInput.userApiKey && competitorAnalyses.length > 0) {
      try {
        const comparisons = await compareWithCompetitors(
          websiteAnalysis,
          competitorAnalyses,
          businessProfile,
          llmProvider
        );
        for (const [url, note] of Object.entries(comparisons)) {
          await supabase
            .from("report_competitors")
            .update({ comparison_note: note })
            .eq("report_id", reportId)
            .eq("website_url", url);
        }
      } catch (err) {
        if (isGroqQuotaError(err)) quotaLimitHit = true;
        console.warn("[Pipeline] Competitor comparison threw unexpectedly:", err);
      }
    }

    // ── Step 6: Profile-aware deterministic scoring ─────────────────────────
    const { scores, findings } = scoreWebsite(
      websiteAnalysis,
      effectiveFormInput,
      businessProfile,
      businessFeatures
    );
    const recommendations = generateRecommendations(
      findings,
      websiteAnalysis,
      businessProfile,
      businessFeatures
    );
    const scoreExplanation: ScoreExplanation = generateScoreExplanation(scores, findings);

    // ── Step 6b: LLM content quality scoring (userApiKey only) ───────────────
    if (formInput.userApiKey) {
      try {
        const qualityFindings = await scoreContentQualityWithLlm(
          websiteAnalysis,
          effectiveFormInput.businessName,
          effectiveFormInput.city,
          llmProvider
        );
        findings.push(...qualityFindings);
      } catch (err) {
        if (isGroqQuotaError(err)) quotaLimitHit = true;
        console.warn("[Pipeline] Content quality scoring threw unexpectedly:", err);
      }
    }

    // ── Step 7: Profile-aware deterministic FAQs (needed for LLM prompt) ────
    const faqRows = generateFaqs(businessProfile);

    // ── Step 8: LLM summary (one optional call) ──────────────────────────────
    let llmSummary: LlmReportSummary;
    try {
      llmSummary = await generateLlmSummary(
        effectiveFormInput,
        websiteAnalysis,
        scores,
        findings,
        businessProfile,
        faqRows.map((f) => f.question),
        llmProvider
      );
    } catch (err) {
      if (isGroqQuotaError(err)) quotaLimitHit = true;
      llmSummary = buildFallbackSummary(
        effectiveFormInput,
        findings.filter((f) => f.type === "strength"),
        findings.filter((f) => f.type === "gap"),
        faqRows.map((f) => f.question)
      );
    }

    // Always use category-specific FAQ draft from faqRows — never the LLM/mock
    // generic fallback. Only falls back to generic if faqRows itself is generic.
    if (llmSummary.contentAssetType === "faq" && faqRows.length > 0) {
      llmSummary.contentAssetDraft = buildFaqDraft(
        faqRows.map((f) => f.question),
        effectiveFormInput.businessName || inferredName
      );
    }

    // ── Step 8a: Build normalized input for Grok ─────────────────────────────
    const grokInput: GrokEnhancementInput = {
      business: {
        name: effectiveFormInput.businessName || inferredName || "this business",
        category: businessProfile.sector,
        subtype: businessProfile.subtype,
        location: effectiveCity,
      },
      scores: {
        overall: scores.overallScore,
        contentClarity: scores.contentClarityScore,
        serviceSpecificity: scores.serviceSpecificityScore,
        localRelevance: scores.localRelevanceScore,
        trustSignals: scores.trustSignalScore,
        faqDiscoverability: scores.faqDiscoverabilityScore,
      },
      strengths: findings
        .filter((f) => f.type === "strength")
        .map((f) => ({ label: f.label, detail: f.detail })),
      gaps: findings
        .filter((f) => f.type === "gap")
        .map((f) => ({ label: f.label, detail: f.detail })),
      recommendations: recommendations.map((r) => ({
        title: r.title,
        description: r.description,
        impact: r.impact,
        effort: r.effort,
      })),
      faq_questions: faqRows.map((f) => f.question),
    };

    // ── Step 8b: Grok enhancement (non-blocking, best-effort) ─────────────────
    // Deterministic content is always the fallback. If Grok fails or is not
    // configured, the report renders fully from the deterministic outputs.
    let grokEnhancement: GrokEnhancement | null = null;
    try {
      grokEnhancement = await enhanceWithGrok(grokInput, llmProvider);
    } catch (err) {
      if (isGroqQuotaError(err)) quotaLimitHit = true;
      console.error("[Pipeline] Grok enhancement threw unexpectedly:", err);
    }

    // ── Step 8c: Merge Grok enhancements (mutate in place before DB writes) ───
    if (grokEnhancement) {
      // 1. Enhanced positioning summary
      if (grokEnhancement.enhanced_positioning_summary) {
        llmSummary.positioningSummary = grokEnhancement.enhanced_positioning_summary;
      }
      // 2. Enhanced recommendation explanations (used in Step 12e DB write)
      if (grokEnhancement.enhanced_recommendation_explanations) {
        for (const rec of recommendations) {
          const enhanced =
            grokEnhancement.enhanced_recommendation_explanations[rec.title];
          if (enhanced) rec.description = enhanced;
        }
      }
      // 3. FAQ answers (used in Step 12i DB write)
      if (grokEnhancement.enhanced_faq_answers) {
        const answerMap = new Map(
          grokEnhancement.enhanced_faq_answers.map((a) => [a.question, a.answer])
        );
        for (const row of faqRows) {
          const answer = answerMap.get(row.question);
          if (answer) row.answer = answer;
        }
      }
    }

    // ── Step 9: Compute enriched metadata ───────────────────────────────────
    const services = formInput.topServices ?? [];
    const detectedLocationTerms = extractLocationTerms(websiteAnalysis, effectiveCity);
    const detectedServiceTerms = extractServiceTerms(websiteAnalysis, services);
    const keywordCounts = buildKeywordCounts(websiteAnalysis);
    const scannedPageType = detectPageType(websiteAnalysis);
    const evidenceSnapshot = buildEvidenceSnapshot(websiteAnalysis, pagesScanned);

    // ── Step 10: Profile-aware query coverage ───────────────────────────────
    let queryCoverageRows = computeQueryCoverage(
      websiteAnalysis,
      businessProfile,
      businessFeatures,
      effectiveCity,
      services
    );

    // ── Step 10b: Guardrail — reject sector/pattern mismatch ────────────────
    // Physical/local sectors must never produce software_product queries.
    // If the pattern slipped through (LLM signal false positive), force-correct
    // it here and recompute query coverage before it propagates to visibility
    // simulation and FAQ generation.
    const PHYSICAL_SECTORS = new Set([
      "food_and_beverage", "retail_store", "hospitality",
      "home_services", "health_wellness", "fitness",
    ]);
    if (
      PHYSICAL_SECTORS.has(businessProfile.sector ?? "") &&
      businessProfile.website_pattern === "software_product"
    ) {
      console.error(
        `[Pipeline] SECTOR MISMATCH: sector=${businessProfile.sector} produced website_pattern=software_product. ` +
        `Forcing local_physical_business and recomputing query coverage.`
      );
      businessProfile.website_pattern = "local_physical_business";
      queryCoverageRows.splice(
        0,
        queryCoverageRows.length,
        ...computeQueryCoverage(websiteAnalysis, businessProfile, businessFeatures, effectiveCity, services)
      );
    }

    // ── Step 10c: No-URL mode — derive local pattern from sector ─────────────
    // When no website was scraped, all pattern signals are absent and the
    // pattern defaults to generic_unknown. If Groq gave us a sector and the
    // user provided a city, we can infer a more useful local pattern so that
    // local queries ("hotel near me", "dentist Smyrna TN") are generated
    // instead of generic fallbacks like "business services contact".
    if (
      !formInput.websiteUrl &&
      effectiveCity &&
      businessProfile.website_pattern === "generic_unknown" &&
      businessProfile.sector
    ) {
      const sector = businessProfile.sector;
      let noUrlPattern: typeof businessProfile.website_pattern;
      if (sector === "hospitality") {
        noUrlPattern = "hospitality_booking";
      } else if (["health_wellness", "fitness", "professional_services"].includes(sector)) {
        noUrlPattern = "appointment_service";
      } else {
        noUrlPattern = "local_physical_business";
      }
      businessProfile.website_pattern = noUrlPattern;
      queryCoverageRows.splice(
        0,
        queryCoverageRows.length,
        ...computeQueryCoverage(websiteAnalysis, businessProfile, businessFeatures, effectiveCity, services)
      );
      console.log(
        `[Pipeline] No-URL mode: inferred website_pattern=${noUrlPattern} from sector=${sector}`
      );
    }

    // ── Step 10d: Semantic query coverage enhancement (userApiKey only) ────────
    if (formInput.userApiKey) {
      try {
        queryCoverageRows = await enhanceQueryCoverageWithSemantics(
          queryCoverageRows,
          websiteAnalysis,
          llmProvider
        );
      } catch (err) {
        if (isGroqQuotaError(err)) quotaLimitHit = true;
        console.warn("[Pipeline] Semantic query enhancement threw unexpectedly:", err);
      }
    }

    // ── Step 11: Signal rows ──────────────────────────────────────────────────
    const signalRows = buildSignalRows(websiteAnalysis, effectiveCity);

    // ── Step 11c: Validation sanity checks (log only — no hard failures) ──────
    {
      const hasStructuredAddr = !!(websiteAnalysis.schemaOrgAddress?.city || websiteAnalysis.metaCity);
      if (scores.localRelevanceScore === 0 && hasStructuredAddr) {
        console.error(
          `[Validation] localRelevanceScore=0 but structured address present —`,
          websiteAnalysis.schemaOrgAddress ?? { metaCity: websiteAnalysis.metaCity }
        );
      }
      const resolvedName = effectiveFormInput.businessName || inferredName;
      if (!resolvedName && !websiteAnalysis.fetchError) {
        console.warn("[Validation] Business name could not be extracted despite successful scrape");
      }
      if (groqClassification && businessProfile.sector !== groqClassification.sector && groqClassification.confidence === "high") {
        console.warn(
          `[Validation] Sector mismatch — profile.sector=${businessProfile.sector} but Groq says ${groqClassification.sector} (high confidence). Check classification pipeline.`
        );
      }
    }

    // ── Step 11b: Visibility simulation (non-blocking, best-effort) ──────────
    // Asks the LLM which companies it recommends for each generated query and
    // checks whether the analyzed business appears. Returns null when MOCK_LLM=true
    // or all LLM calls fail — report renders fully without this feature.
    let visibilitySimResult: { result: VisibilitySimulationResult; rows: VisibilitySimulationRow[] } | null = null;
    try {
      const businessNameForSim =
        effectiveFormInput.businessName || inferredName || "";
      console.log("[DIAG 11b] MOCK_LLM:", process.env.MOCK_LLM, "| businessName:", businessNameForSim || "(empty)", "| queryCoverageRows:", queryCoverageRows.length);
      if (businessNameForSim) {
        // Business type priority: Groq specific category ("hotel") > subtype ("yoga studio") > sector ("hospitality")
        const simBusinessType =
          groqClassification?.category ??
          businessProfile.subtype ??
          businessProfile.sector;
        visibilitySimResult = await simulateVisibility(
          businessNameForSim,
          queryCoverageRows,
          simBusinessType,
          effectiveCity,
          llmProvider
        );
        console.log("[DIAG 11b] simulateVisibility result:", visibilitySimResult === null ? "null" : `${visibilitySimResult.rows.length} rows`);
      } else {
        console.warn("[DIAG 11b] Skipped — businessName is empty");
      }
    } catch (err) {
      console.error("[DIAG 11b] Visibility simulation threw unexpectedly:", err);
    }

    // ── Step 11e: Visibility gap explanations (userApiKey only) ─────────────
    if (formInput.userApiKey && visibilitySimResult) {
      try {
        const gapExplanations = await explainVisibilityGaps(
          visibilitySimResult.result,
          visibilitySimResult.rows,
          websiteAnalysis,
          businessProfile,
          llmProvider
        );
        if (Object.keys(gapExplanations).length > 0) {
          visibilitySimResult.result.gapExplanations = gapExplanations;
        }
      } catch (err) {
        if (isGroqQuotaError(err)) quotaLimitHit = true;
        console.warn("[Pipeline] Visibility explanation threw unexpectedly:", err);
      }
    }

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

    // 12f. LLM outputs (includes Grok enhancement + visibility summary when available)
    const { error: llmUpsertError } = await supabase.from("report_llm_outputs").upsert({
      report_id: reportId,
      positioning_summary: llmSummary.positioningSummary,
      top_strengths: llmSummary.topStrengths,
      top_opportunities: llmSummary.topOpportunities,
      content_asset_type: llmSummary.contentAssetType,
      content_asset_draft: llmSummary.contentAssetDraft,
      model_used: process.env.LLM_MODEL ?? "unknown",
      grok_enhancement: grokEnhancement ?? null,
      quick_wins_bucket: grokEnhancement?.optional_quick_wins_bucket ?? null,
      visibility_summary: visibilitySimResult?.result ?? null,
    });
    if (llmUpsertError) {
      console.error("[DIAG 12f] report_llm_outputs upsert error (likely migration 008 not applied):", llmUpsertError.message);
    }

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
          evidence_note: q.evidenceNote ?? null,
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

    // 12k. Visibility simulation rows
    if (visibilitySimResult && visibilitySimResult.rows.length > 0) {
      await supabase.from("report_visibility_simulation").delete().eq("report_id", reportId);
      const { error: visInsertError } = await supabase.from("report_visibility_simulation").insert(
        visibilitySimResult.rows.map((r) => ({
          report_id: reportId,
          query: r.query,
          mentioned_companies: r.mentionedCompanies,
          analyzed_business_appears: r.analyzedBusinessAppears,
          simulated_response: r.simulatedResponse ?? null,
          appearance_type: r.appearanceType ?? null,
          query_coverage_quality: r.queryCoverageQuality ?? null,
        }))
      );
      if (visInsertError) {
        console.error("[DIAG 12k] report_visibility_simulation insert error (likely migration 008 not applied):", visInsertError.message);
      } else {
        console.log("[DIAG 12k] Wrote", visibilitySimResult.rows.length, "visibility simulation rows");
      }
    } else {
      console.log("[DIAG 12k] Skipped — no simulation rows to write (visibilitySimResult:", visibilitySimResult === null ? "null" : "empty rows", ")");
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
      // Backward-compat: keep canonical_category/confidence/evidence fields populated
      canonical_category: businessProfile.sector ?? "generic",
      category_confidence: businessProfile.confidence,
      category_evidence: businessProfile.matched_rules.join(", ") || "No specific evidence found.",
      inferred_services: detectedServiceTerms.length > 0 ? detectedServiceTerms : null,
      // Archetype columns (migration 005) — preserved for backward compat
      archetype,
      archetype_confidence: archetypeConfidence,
      subtype,
      subtype_confidence: subtypeConfidence,
      classification_evidence: archetypeResult.evidence,
      // New: multi-dimensional business profile (migration 006)
      business_profile: businessProfile,
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
      archetypeClassification: archetypeResult,
      businessProfile,
      quotaLimitHit,
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
