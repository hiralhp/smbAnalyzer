// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Scoring Engine
//
// Takes a WebsiteAnalysis and returns a ScoreBreakdown + list of Findings.
// No LLM calls here — pure rule-based logic.
//
// Each finding now includes: confidence, evidence, sourceSignal, ruleId
// so findings are queryable and explainable independently of the UI.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WebsiteAnalysis,
  ScoreBreakdown,
  ScoreExplanation,
  Finding,
  FindingCategory,
  FindingConfidence,
  ReportFormInput,
  CanonicalCategory,
  BusinessFeatures,
} from "@/lib/types";
import {
  DEFAULT_WEIGHTS,
  CATEGORY_WEIGHTS,
  CATEGORY_REC_OVERRIDES,
  type RecTemplate,
} from "./category-templates";

// ── Score rule helpers ────────────────────────────────────────────────────────

interface ScoredCondition {
  points: number;
  condition: boolean;
  category: FindingCategory;
  confidence: FindingConfidence;
  ruleId: string;
  sourceSignal: string;
  strengthLabel?: string;
  strengthDetail?: string;
  strengthEvidence?: string;
  gapLabel?: string;
  gapDetail?: string;
  gapEvidence?: string;
}

function applyRules(
  rules: ScoredCondition[],
  maxPossible: number,
  sourceUrl?: string
): { rawScore: number; findings: Finding[] } {
  let rawScore = 0;
  const findings: Finding[] = [];

  for (const rule of rules) {
    if (rule.condition) {
      rawScore += rule.points;
      if (rule.strengthLabel) {
        findings.push({
          type: "strength",
          category: rule.category,
          label: rule.strengthLabel,
          detail: rule.strengthDetail,
          confidence: rule.confidence,
          evidence: rule.strengthEvidence,
          sourceSignal: rule.sourceSignal,
          ruleId: rule.ruleId,
        });
      }
    } else {
      if (rule.gapLabel) {
        findings.push({
          type: "gap",
          category: rule.category,
          label: rule.gapLabel,
          detail: rule.gapDetail,
          confidence: rule.confidence,
          evidence: rule.gapEvidence,
          sourceSignal: rule.sourceSignal,
          ruleId: rule.ruleId,
        });
      }
    }
  }

  // Normalize to 0–100
  const normalized = Math.round((rawScore / maxPossible) * 100);
  return { rawScore: Math.min(100, Math.max(0, normalized)), findings };
}

// ── Sub-score: Content Clarity (max 40 pts) ───────────────────────────────────

function scoreContentClarity(a: WebsiteAnalysis, sourceUrl?: string): {
  score: number;
  findings: Finding[];
} {
  const rules: ScoredCondition[] = [
    {
      points: 10,
      condition: !!a.title,
      category: "content",
      confidence: "high",
      ruleId: "title_tag_present",
      sourceSignal: "title_tag",
      strengthLabel: "Descriptive title tag",
      strengthDetail: `Title: "${a.title}"`,
      strengthEvidence: `<title> tag found: "${a.title}"`,
      gapLabel: "Missing title tag",
      gapDetail: "A clear title tag helps AI understand what the business is.",
      gapEvidence: "No <title> element detected on the page.",
    },
    {
      points: 10,
      condition: !!a.metaDescription,
      category: "content",
      confidence: "high",
      ruleId: "meta_description_present",
      sourceSignal: "meta_description",
      strengthLabel: "Meta description present",
      strengthDetail: `"${a.metaDescription?.slice(0, 80)}..."`,
      strengthEvidence: `Meta description found: "${a.metaDescription?.slice(0, 100)}"`,
      gapLabel: "No meta description",
      gapDetail: "A meta description gives AI a concise business summary.",
      gapEvidence: "No <meta name=\"description\"> tag found in page <head>.",
    },
    {
      points: 10,
      condition: a.h1Headings.length > 0,
      category: "content",
      confidence: "high",
      ruleId: "h1_present",
      sourceSignal: "h1_heading",
      strengthLabel: "Clear H1 heading",
      strengthDetail: `H1: "${a.h1Headings[0]}"`,
      strengthEvidence: `<h1> detected: "${a.h1Headings[0]}"`,
      gapLabel: "No H1 heading detected",
      gapDetail: "H1 headings are a primary signal for AI topic extraction.",
      gapEvidence: "No <h1> element found on the page.",
    },
    {
      points: 10,
      condition: a.h2Headings.length >= 3,
      category: "content",
      confidence: "high",
      ruleId: "h2_structure",
      sourceSignal: "h2_count",
      strengthLabel: "Multiple H2 section headings",
      strengthDetail: `Found ${a.h2Headings.length} section headings, improving content structure.`,
      strengthEvidence: `${a.h2Headings.length} <h2> elements found, providing clear content sections.`,
      gapLabel: "Insufficient content structure (few H2 headings)",
      gapDetail: "Adding H2 headings for each major topic area improves AI comprehension.",
      gapEvidence: `Only ${a.h2Headings.length} <h2> heading${a.h2Headings.length === 1 ? "" : "s"} found; at least 3 are recommended for good content structure.`,
    },
  ];

  const { rawScore, findings } = applyRules(rules, 40, sourceUrl);
  return { score: rawScore, findings };
}

// ── Sub-score: Service Specificity (max 30 pts) ───────────────────────────────

function scoreServiceSpecificity(
  a: WebsiteAnalysis,
  formInput: ReportFormInput,
  sourceUrl?: string,
  businessFeatures?: BusinessFeatures
): { score: number; findings: Finding[] } {
  const services = formInput.topServices ?? [];
  const servicesProvided = services.length > 0;

  const matchingH2 = servicesProvided
    ? a.h2Headings.find((h) =>
        services.some((s) => h.toLowerCase().includes(s.toLowerCase()))
      )
    : undefined;

  const servicesInHeadingsCondition =
    servicesProvided && !!matchingH2;

  // Pricing rule — specialized for quote-intent businesses
  const isQuoteBusiness = businessFeatures?.hasQuoteIntent ?? false;
  const pricingRule: ScoredCondition = isQuoteBusiness
    ? {
        points: 5,
        condition: a.hasPricing,
        category: "service",
        confidence: "high",
        ruleId: "pricing_language",
        sourceSignal: "pricing",
        strengthLabel: "Estimate or quote CTA present",
        strengthDetail: "Quote/estimate language helps AI recommend you when customers search for estimates.",
        strengthEvidence: 'Estimate or quote-related terms detected (e.g. "free estimate", "get a quote", "no obligation").',
        gapLabel: "No free estimate or quote CTA",
        gapDetail: "Adding 'Free Estimate' or 'Get a Quote' language is critical — AI uses this to recommend you for estimate-request searches.",
        gapEvidence: 'No estimate or quote language found ("free estimate", "get a quote", "no obligation estimate").',
      }
    : {
        points: 5,
        condition: a.hasPricing,
        category: "service",
        confidence: "medium",
        ruleId: "pricing_language",
        sourceSignal: "pricing",
        strengthLabel: "Pricing language present",
        strengthDetail: "Pricing context helps AI qualify your business for budget-aware queries.",
        strengthEvidence: 'Pricing-related terms detected (e.g. "quote", "estimate", "$", "starting at").',
        gapLabel: "No pricing language detected",
        gapDetail: "Adding pricing context (even ranges) helps AI match your business to intent-specific searches.",
        gapEvidence: 'No pricing-related terms found ("price", "cost", "quote", "estimate", "$").',
      };

  const rules: ScoredCondition[] = [
    {
      points: 15,
      condition: a.hasServicePages,
      category: "service",
      confidence: "medium",
      ruleId: "service_pages_present",
      sourceSignal: "service_pages",
      strengthLabel: "Dedicated service pages detected",
      strengthDetail: "Individual service pages help AI recommend you for specific queries.",
      strengthEvidence: "Service-oriented links detected (e.g. paths containing /services, /solutions, /work).",
      gapLabel: "No dedicated service pages",
      gapDetail: "Creating separate pages for each service dramatically improves AI discoverability.",
      gapEvidence: "No links with service-oriented path segments (/services, /solutions, /work) found in page navigation.",
    },
    {
      points: 10,
      condition: servicesInHeadingsCondition,
      category: "service",
      confidence: servicesProvided ? "high" : "medium",
      ruleId: "services_in_headings",
      sourceSignal: "services_in_headings",
      strengthLabel: "Services mentioned in headings",
      strengthDetail: "Service names appear in H2 headings, signaling service content to AI.",
      strengthEvidence: matchingH2
        ? `Service keyword found in H2: "${matchingH2}"`
        : "Service terms found in headings.",
      gapLabel: "Services not prominent in headings",
      gapDetail: "Mention your specific services in H2 headings so AI can surface them in responses.",
      gapEvidence: servicesProvided
        ? `None of the provided services (${services.slice(0, 3).join(", ")}) were found in any H2 heading.`
        : "No top services provided — cannot check heading prominence.",
    },
    pricingRule,
  ];

  const { rawScore, findings } = applyRules(rules, 30, sourceUrl);
  return { score: rawScore, findings };
}

// ── Sub-score: Local Relevance (max 25 pts) ───────────────────────────────────

function scoreLocalRelevance(
  a: WebsiteAnalysis,
  formInput: ReportFormInput,
  sourceUrl?: string
): { score: number; findings: Finding[] } {
  const cityLower = (formInput.city ?? "").toLowerCase();
  const prominentText = [
    a.title,
    ...(a.h1Headings ?? []),
    ...(a.h2Headings ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const cityInTitle =
    cityLower.length > 0 && (a.title ?? "").toLowerCase().includes(cityLower);
  const cityInHeadings =
    cityLower.length > 0 && prominentText.includes(cityLower);

  const rules: ScoredCondition[] = [
    {
      points: 10,
      condition: a.hasLocationMention,
      category: "local",
      confidence: "medium",
      ruleId: "location_mention",
      sourceSignal: "location_mention",
      strengthLabel: "Location clearly mentioned",
      strengthDetail: "City or location reference detected in prominent page positions.",
      strengthEvidence: "Location language detected in title or H1 (e.g. city+state pattern, or terms like 'serving', 'located in').",
      gapLabel: "Location not clearly stated",
      gapDetail: "AI assistants use location signals to match businesses to \"near me\" and city-specific queries.",
      gapEvidence: "No city/state pattern or location language ('serving', 'located in', 'based in') detected in title or H1.",
    },
    {
      points: 8,
      condition: cityInTitle,
      category: "local",
      confidence: cityLower.length > 0 ? "high" : "low",
      ruleId: "city_in_title",
      sourceSignal: "city_in_title",
      strengthLabel: "City name in title tag",
      strengthDetail: `"${formInput.city}" appears in the page title, a strong local signal.`,
      strengthEvidence: `"${formInput.city}" found in page <title> tag.`,
      gapLabel: "City not in title tag",
      gapDetail: `Adding "${formInput.city}" to your title tag is one of the easiest local relevance wins.`,
      gapEvidence: cityLower.length > 0
        ? `"${formInput.city}" not found in the page <title> tag.`
        : "No city provided — cannot check city presence in title.",
    },
    {
      points: 7,
      condition: cityInHeadings,
      category: "local",
      confidence: cityLower.length > 0 ? "high" : "low",
      ruleId: "city_in_headings",
      sourceSignal: "city_in_headings",
      strengthLabel: "Location mentioned in headings",
      strengthDetail: "Local geographic context appears in page headings.",
      strengthEvidence: `"${formInput.city}" found in H1 or H2 headings.`,
      gapLabel: "City not in page headings",
      gapDetail: "Include your city/region in at least one H1 or H2 to strengthen local AI relevance.",
      gapEvidence: cityLower.length > 0
        ? `"${formInput.city}" not found in any H1 or H2 heading.`
        : "No city provided — cannot check heading locality.",
    },
  ];

  const { rawScore, findings } = applyRules(rules, 25, sourceUrl);
  return { score: rawScore, findings };
}

// ── Sub-score: Trust Signals (max 25 pts) ────────────────────────────────────

function scoreTrustSignals(
  a: WebsiteAnalysis,
  sourceUrl?: string,
  businessFeatures?: BusinessFeatures
): { score: number; findings: Finding[] } {
  // Credential rule is elevated to high confidence for regulated/credentialed businesses
  const isRegulated = businessFeatures?.requiresCredentials ?? false;
  const credentialConfidence: FindingConfidence = isRegulated ? "high" : "medium";
  const credentialGapDetail = isRegulated
    ? "License and insurance credentials are expected in your industry — AI systems treat their absence as a significant trust gap."
    : 'Mentioning licensing, certifications, or guarantees ("licensed & insured") significantly boosts AI trust scoring.';

  const rules: ScoredCondition[] = [
    {
      points: 8,
      condition: a.hasContactInfo,
      category: "trust",
      confidence: "high",
      ruleId: "contact_info_present",
      sourceSignal: "contact_info",
      strengthLabel: "Contact information present",
      strengthDetail: "Phone number or email address detected on the page.",
      strengthEvidence: "Phone number or email address pattern matched on the page.",
      gapLabel: "No contact information detected",
      gapDetail: "Visible contact details are a basic trust signal AI systems use to verify legitimacy.",
      gapEvidence: "No phone number (e.g. 555-555-5555) or email address found on the homepage.",
    },
    {
      points: 7,
      condition: a.hasTestimonials,
      category: "trust",
      confidence: "medium",
      ruleId: "testimonials_present",
      sourceSignal: "testimonials",
      strengthLabel: "Customer testimonials embedded",
      strengthDetail: "Review or testimonial content detected on the site.",
      strengthEvidence: 'Testimonial/review keywords detected (e.g. "testimonial", "what our customers say", "★").',
      gapLabel: "No embedded reviews or testimonials",
      gapDetail: "Customer reviews embedded directly on your site strengthen AI trust signals.",
      gapEvidence: 'No review or testimonial language found ("testimonial", "review", "what our customers", "5 star").',
    },
    {
      points: 6,
      condition: a.hasTrustSignals,
      category: "trust",
      confidence: credentialConfidence,
      ruleId: "trust_keywords_present",
      sourceSignal: "trust_keywords",
      strengthLabel: "Professional trust indicators",
      strengthDetail: "Words like licensed, certified, insured, or guaranteed were detected.",
      strengthEvidence: 'Professional credential language found (e.g. "licensed", "certified", "insured", "accredited").',
      gapLabel: "No professional trust indicators",
      gapDetail: credentialGapDetail,
      gapEvidence: 'No credential language found ("licensed", "certified", "insured", "accredited", "guaranteed", "BBB").',
    },
    {
      points: 4,
      condition: a.hasHours,
      category: "trust",
      confidence: "medium",
      ruleId: "hours_present",
      sourceSignal: "hours",
      strengthLabel: "Business hours mentioned",
      strengthDetail: "Operating hours help AI assistants answer availability questions about your business.",
      strengthEvidence: 'Hours-related content detected (e.g. "Monday", "open", "am/pm", "24/7").',
      gapLabel: "No business hours detected",
      gapDetail: "Adding operating hours helps AI answer questions like \"Are they open now?\"",
      gapEvidence: 'No hours-related language found ("Monday", "hours", "open", "am", "pm", "24/7").',
    },
  ];

  const { rawScore, findings } = applyRules(rules, 25, sourceUrl);
  return { score: rawScore, findings };
}

// ── Sub-score: FAQ / Discoverability (max 20 pts) ────────────────────────────

function scoreFaqDiscoverability(a: WebsiteAnalysis, sourceUrl?: string): {
  score: number;
  findings: Finding[];
} {
  const rules: ScoredCondition[] = [
    {
      points: 15,
      condition: a.hasFaq,
      category: "faq",
      confidence: "medium",
      ruleId: "faq_present",
      sourceSignal: "has_faq",
      strengthLabel: "FAQ section detected",
      strengthDetail: "FAQ content helps AI surface direct answers about your business.",
      strengthEvidence: 'FAQ-related content detected (e.g. "FAQ", "Frequently Asked Questions", "Q&A").',
      gapLabel: "No FAQ section detected",
      gapDetail: "A FAQ section is the single highest-impact change for AI discoverability.",
      gapEvidence: 'No FAQ-like headings or sections found ("faq", "frequently asked", "common questions", "q&a").',
    },
    {
      points: 5,
      condition: a.h2Headings.length >= 5,
      category: "faq",
      confidence: "high",
      ruleId: "content_depth",
      sourceSignal: "h2_count",
      strengthLabel: "Rich content structure",
      strengthDetail: `${a.h2Headings.length} H2 headings provide strong topical coverage.`,
      strengthEvidence: `${a.h2Headings.length} <h2> headings detected — strong topical depth.`,
      gapLabel: "Limited topical depth",
      gapDetail: "Expand content depth with more structured sections to improve topical coverage for AI.",
      gapEvidence: `Only ${a.h2Headings.length} <h2> heading${a.h2Headings.length === 1 ? "" : "s"} found; at least 5 sections are recommended for strong topical coverage.`,
    },
  ];

  const { rawScore, findings } = applyRules(rules, 20, sourceUrl);
  return { score: rawScore, findings };
}

// ── Score explanation generator ───────────────────────────────────────────────

/**
 * Build a human-readable + machine-readable explanation for each score bucket.
 * Purely deterministic — uses scores and findings, no LLM.
 */
export function generateScoreExplanation(
  scores: ScoreBreakdown,
  findings: Finding[]
): ScoreExplanation {
  const gaps = findings.filter((f) => f.type === "gap");
  const strengths = findings.filter((f) => f.type === "strength");

  function gapsIn(category: string): Finding[] {
    return gaps.filter((f) => f.category === category);
  }
  function strengthsIn(category: string): Finding[] {
    return strengths.filter((f) => f.category === category);
  }

  // Content clarity
  const contentGaps = gapsIn("content");
  let contentClarity: string;
  if (scores.contentClarityScore >= 75) {
    contentClarity = "Strong content structure with title, meta description, and multiple headings.";
  } else if (contentGaps.length === 0) {
    contentClarity = "Content structure is adequate.";
  } else {
    contentClarity = `Missing: ${contentGaps.map((g) => g.label.toLowerCase()).join("; ")}.`;
  }

  // Service specificity
  const serviceGaps = gapsIn("service");
  let serviceSpecificity: string;
  if (scores.serviceSpecificityScore >= 75) {
    serviceSpecificity = "Service pages and service headings detected — good AI service discoverability.";
  } else if (serviceGaps.length === 0) {
    serviceSpecificity = "Services are reasonably well represented.";
  } else {
    serviceSpecificity = `Missing: ${serviceGaps.map((g) => g.label.toLowerCase()).join("; ")}.`;
  }

  // Local relevance
  const localGaps = gapsIn("local");
  let localRelevance: string;
  if (scores.localRelevanceScore >= 75) {
    localRelevance = "City and location signals are present in prominent positions.";
  } else if (localGaps.length === 0) {
    localRelevance = "Location is reasonably well indicated.";
  } else {
    localRelevance = `Missing: ${localGaps.map((g) => g.label.toLowerCase()).join("; ")}.`;
  }

  // Trust signals
  const trustGaps = gapsIn("trust");
  let trustSignals: string;
  if (scores.trustSignalScore >= 75) {
    trustSignals = "Strong trust signals including contact info, testimonials, and credentials.";
  } else if (trustGaps.length === 0) {
    trustSignals = "Trust signals are adequate.";
  } else {
    trustSignals = `Missing: ${trustGaps.map((g) => g.label.toLowerCase()).join("; ")}.`;
  }

  // FAQ
  const faqGaps = gapsIn("faq");
  let faqDiscoverability: string;
  if (scores.faqDiscoverabilityScore >= 75) {
    faqDiscoverability = "FAQ content and rich structure detected — excellent AI answer coverage.";
  } else if (faqGaps.find((g) => g.ruleId === "faq_present")) {
    faqDiscoverability = "No FAQ section detected — highest impact gap for AI discoverability.";
  } else {
    faqDiscoverability = "Limited topical depth; adding FAQ content would significantly improve AI coverage.";
  }

  // Overall
  const totalGaps = gaps.length;
  const totalStrengths = strengths.length;
  let overall: string;
  if (scores.overallScore >= 80) {
    overall = `Strong overall AI visibility with ${totalStrengths} signals detected and only ${totalGaps} gap${totalGaps === 1 ? "" : "s"}.`;
  } else if (scores.overallScore >= 50) {
    overall = `Moderate AI visibility. ${totalStrengths} signals detected, ${totalGaps} gap${totalGaps === 1 ? "" : "s"} to address.`;
  } else {
    overall = `Low AI visibility — ${totalGaps} signal gap${totalGaps === 1 ? "" : "s"} significantly reduce discoverability.`;
  }

  return {
    overall,
    contentClarity,
    serviceSpecificity,
    localRelevance,
    trustSignals,
    faqDiscoverability,
  };
}

// ── Main scoring function ─────────────────────────────────────────────────────

/**
 * Run all scoring rules against a WebsiteAnalysis and return scores + findings.
 * Deterministic — no LLM calls.
 * Accepts optional canonicalCategory to apply category-specific score weights.
 */
export function scoreWebsite(
  analysis: WebsiteAnalysis,
  formInput: ReportFormInput,
  canonicalCategory: CanonicalCategory = "generic",
  businessFeatures?: BusinessFeatures
): { scores: ScoreBreakdown; findings: Finding[] } {
  const sourceUrl = analysis.url || undefined;

  if (analysis.fetchError && analysis.fetchError !== "no_url_provided") {
    return {
      scores: {
        overallScore: 0,
        contentClarityScore: 0,
        serviceSpecificityScore: 0,
        localRelevanceScore: 0,
        trustSignalScore: 0,
        faqDiscoverabilityScore: 0,
      },
      findings: [
        {
          type: "gap",
          category: "general",
          label: "Website could not be analyzed",
          detail: `Error: ${analysis.fetchError}`,
          confidence: "high",
          evidence: `Fetch error: ${analysis.fetchError}`,
          sourceSignal: "fetch_success",
          ruleId: "website_fetchable",
        },
      ],
    };
  }

  // For no-URL reports, return all gaps but still run scoring
  if (analysis.fetchError === "no_url_provided") {
    const noUrlFindings: Finding[] = [
      {
        type: "gap",
        category: "general",
        label: "No website provided",
        detail: "Analysis is based on the business name and city only. Add a website URL for a complete report.",
        confidence: "high",
        evidence: "No website URL was provided for this report.",
        sourceSignal: "has_website",
        ruleId: "website_present",
      },
    ];
    return {
      scores: {
        overallScore: 0,
        contentClarityScore: 0,
        serviceSpecificityScore: 0,
        localRelevanceScore: 0,
        trustSignalScore: 0,
        faqDiscoverabilityScore: 0,
      },
      findings: noUrlFindings,
    };
  }

  const clarity = scoreContentClarity(analysis, sourceUrl);
  const service = scoreServiceSpecificity(analysis, formInput, sourceUrl, businessFeatures);
  const local = scoreLocalRelevance(analysis, formInput, sourceUrl);
  const trust = scoreTrustSignals(analysis, sourceUrl, businessFeatures);
  const faq = scoreFaqDiscoverability(analysis, sourceUrl);

  // Apply category-specific weights (falls back to defaults for generic)
  const weights = CATEGORY_WEIGHTS[canonicalCategory] ?? DEFAULT_WEIGHTS;

  const overallScore = Math.round(
    clarity.score * weights.contentClarity +
      service.score * weights.serviceSpecificity +
      local.score * weights.localRelevance +
      trust.score * weights.trustSignals +
      faq.score * weights.faqDiscoverability
  );

  const findings: Finding[] = [
    ...clarity.findings,
    ...service.findings,
    ...local.findings,
    ...trust.findings,
    ...faq.findings,
  ];

  return {
    scores: {
      overallScore,
      contentClarityScore: clarity.score,
      serviceSpecificityScore: service.score,
      localRelevanceScore: local.score,
      trustSignalScore: trust.score,
      faqDiscoverabilityScore: faq.score,
    },
    findings,
  };
}

/**
 * Generate prioritized recommendations from gap findings.
 * Uses category-specific templates when available, falls back to generic.
 * Returns up to 5 recommendations sorted by impact.
 */
export function generateRecommendations(
  findings: Finding[],
  _analysis: WebsiteAnalysis,
  canonicalCategory: CanonicalCategory = "generic",
  businessFeatures?: BusinessFeatures
): Array<{
  priority: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}> {
  const primaryConversion = businessFeatures?.primaryConversion;
  const isQuoteBusiness = businessFeatures?.hasQuoteIntent ?? false;
  const isBookingBusiness = businessFeatures?.hasBookingOrReservations ?? false;
  const isRegulated = businessFeatures?.requiresCredentials ?? false;

  // FAQ description — specialized for booking businesses
  const faqDescription = isBookingBusiness
    ? "A FAQ section is the highest-impact change for AI discoverability. Include questions like 'How do I book an appointment?', 'What should I bring?', and 'Do you take walk-ins?' — these are exactly the queries AI assistants answer."
    : "A FAQ section is the highest-impact change for AI discoverability. AI assistants frequently pull FAQ content directly to answer user questions. Write 6–10 questions your customers actually ask.";

  // Credential rec — more urgent for regulated businesses
  const credentialDescription = isRegulated
    ? "Display your license number, insurance status, and any certifications prominently — ideally in your header or footer. In your industry, customers expect to see credentials before calling, and AI systems weight their presence heavily."
    : 'Prominently display your license number, insurance status, certifications, or guarantees. Phrases like "Licensed, bonded & insured" directly boost AI trust signals.';

  // Pricing rec — specialized for quote businesses
  const pricingTitle = isQuoteBusiness
    ? "Add a free estimate call-to-action"
    : "Add pricing context to your site";
  const pricingDescription = isQuoteBusiness
    ? "Add a prominent 'Free Estimate' or 'Get a Quote' button to your homepage and service pages. Customers searching for estimates expect to see this CTA — AI assistants use its presence to recommend you for those queries."
    : 'Include pricing ranges, starting prices, or at least an "affordable" or "competitive rates" statement. Pricing context helps AI match your business to budget-specific searches.';

  const gapRecs: Record<
    string,
    {
      title: string;
      description: string;
      impact: "high" | "medium" | "low";
      effort: "high" | "medium" | "low";
    }
  > = {
    "No FAQ section detected": {
      title: "Add a FAQ page or section",
      description: faqDescription,
      impact: "high",
      effort: "low",
    },
    "No dedicated service pages": {
      title: "Create individual service pages",
      description:
        "Build a separate page for each core service you offer. Each page should cover: what the service is, who needs it, what the process looks like, pricing range, and local context.",
      impact: "high",
      effort: "medium",
    },
    "No embedded reviews or testimonials": {
      title: "Embed customer reviews on your site",
      description:
        "Add 3–5 real customer testimonials directly on your homepage and service pages. AI systems use on-site review content to confirm business quality.",
      impact: "medium",
      effort: "low",
    },
    "No professional trust indicators": {
      title: "Add trust credentials to your site",
      description: credentialDescription,
      impact: isRegulated ? "high" : "medium",
      effort: "low",
    },
    "Location not clearly stated": {
      title: "Strengthen your local presence signals",
      description:
        "Add your city and region to your title tag, H1, and throughout body content. Consider adding a service area map or list of neighborhoods you serve.",
      impact: "high",
      effort: "low",
    },
    "City not in title tag": {
      title: "Add your city to the page title",
      description:
        "Update your title tag to include your city name (e.g., \"Best Plumber in Denver | Smith Plumbing\"). This is a 5-minute change with significant AI visibility impact.",
      impact: "high",
      effort: "low",
    },
    "No contact information detected": {
      title: "Make contact information prominent",
      description:
        "Ensure your phone number and email appear in the header, footer, and Contact page. Click-to-call phone numbers also improve mobile conversion.",
      impact: "medium",
      effort: "low",
    },
    "No business hours detected": {
      title: "Add your business hours",
      description:
        "Display your operating hours clearly on your homepage and Contact page. This helps AI answer \"are they open now?\" queries about your business.",
      impact: "low",
      effort: "low",
    },
    "No pricing language detected": {
      title: pricingTitle,
      description: pricingDescription,
      impact: "medium",
      effort: "low",
    },
    "No free estimate or quote CTA": {
      title: pricingTitle,
      description: pricingDescription,
      impact: "high",
      effort: "low",
    },
  };

  // Merge category-specific overrides — they key on ruleId, then map to gap label
  const categoryOverrides = CATEGORY_REC_OVERRIDES[canonicalCategory] ?? {};

  const gaps = findings.filter((f) => f.type === "gap");
  const recs: Array<{
    priority: number;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    effort: "high" | "medium" | "low";
  }> = [];

  const impactOrder: Record<"high" | "medium" | "low", number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  for (const gap of gaps) {
    // Category override by ruleId takes priority over generic label lookup
    const categoryRec: RecTemplate | undefined =
      gap.ruleId ? categoryOverrides[gap.ruleId] : undefined;
    const rec = categoryRec ?? gapRecs[gap.label];
    if (rec) recs.push({ ...rec, priority: 0 });
  }

  recs.sort((a, b) => {
    const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
    if (impactDiff !== 0) return impactDiff;
    return impactOrder[a.effort] - impactOrder[b.effort];
  });

  return recs.slice(0, 5).map((r, i) => ({ ...r, priority: i + 1 }));
}
