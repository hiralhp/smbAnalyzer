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
  BusinessProfile,
  BusinessFeatures,
} from "@/lib/types";
import {
  DEFAULT_WEIGHTS,
  SECTOR_WEIGHTS,
  BUSINESS_MODEL_CONFIGS,
} from "./business-profile-templates";

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
  businessFeatures?: BusinessFeatures,
  profile?: BusinessProfile | null
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

  // Offering content rule — parameterized by business_model via BUSINESS_MODEL_CONFIGS
  const modelConfig = profile ? BUSINESS_MODEL_CONFIGS[profile.business_model] : null;
  const hasOffering = modelConfig ? modelConfig.checkOfferingContent(a) : a.hasServicePages;
  const offeringLabel = modelConfig?.offeringContentLabel ?? "service pages";

  const offeringRule: ScoredCondition = {
    points: 15,
    condition: hasOffering,
    category: "service",
    confidence: "medium",
    ruleId: "offering_content_present",
    sourceSignal: "offering_content",
    strengthLabel: `Dedicated ${offeringLabel} detected`,
    strengthDetail: `Individual ${offeringLabel} help AI recommend you for specific queries.`,
    strengthEvidence: `${offeringLabel} content detected on page.`,
    gapLabel: `No dedicated ${offeringLabel}`,
    gapDetail: `Creating a dedicated ${offeringLabel} section dramatically improves AI discoverability.`,
    gapEvidence: `No ${offeringLabel} found in page content.`,
  };

  // maxPossible shrinks when services are unknown — services_in_headings rule not emitted
  const maxPossible = servicesProvided ? 30 : 20;

  const rules: ScoredCondition[] = [offeringRule];

  // Only emit services_in_headings when services were provided — avoids unevaluatable gap findings
  if (servicesProvided) {
    rules.push({
      points: 10,
      condition: servicesInHeadingsCondition,
      category: "service",
      confidence: "high",
      ruleId: "services_in_headings",
      sourceSignal: "services_in_headings",
      strengthLabel: "Services mentioned in headings",
      strengthDetail: "Service names appear in H2 headings, signaling service content to AI.",
      strengthEvidence: matchingH2
        ? `Service keyword found in H2: "${matchingH2}"`
        : "Service terms found in headings.",
      gapLabel: "Services not prominent in headings",
      gapDetail: "Mention your specific services in H2 headings so AI can surface them in responses.",
      gapEvidence: `None of the provided services (${services.slice(0, 3).join(", ")}) were found in any H2 heading.`,
    });
  }

  rules.push(pricingRule);

  const { rawScore, findings } = applyRules(rules, maxPossible, sourceUrl);
  return { score: rawScore, findings };
}

// ── Sub-score: Local Relevance (max 25 pts) ───────────────────────────────────

function scoreLocalRelevance(
  a: WebsiteAnalysis,
  formInput: ReportFormInput,
  sourceUrl?: string
): { score: number; findings: Finding[] } {
  const cityLower = (formInput.city ?? "").toLowerCase();
  // Normalize: strip state suffix so "brooklyn, ny" matches title containing just "brooklyn"
  const cityForCheck = cityLower.includes(",")
    ? cityLower.split(",")[0].trim()
    : cityLower;

  const prominentText = [
    a.title,
    ...(a.h1Headings ?? []),
    ...(a.h2Headings ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const cityInTitle =
    cityForCheck.length > 0 && (a.title ?? "").toLowerCase().includes(cityForCheck);
  const cityInHeadings =
    cityForCheck.length > 0 && prominentText.includes(cityForCheck);
  const cityInMeta =
    cityForCheck.length > 0 && (a.metaDescription ?? "").toLowerCase().includes(cityForCheck);

  // Structured address (JSON-LD, microdata, or meta city tag) is authoritative —
  // if any structured address source populated a city, location IS clearly stated.
  // This prevents false "location not clearly stated" when the address is in the
  // footer or microdata but not in the title/H1.
  const hasStructuredAddress = !!(a.schemaOrgAddress?.city || a.metaCity);

  // "Location clearly stated" if structured data, scraper flag, OR city in key position.
  const locationClearlyStated =
    hasStructuredAddress ||
    a.hasLocationMention ||
    cityInTitle ||
    cityInHeadings ||
    cityInMeta;

  // maxPossible shrinks when city is unknown — city rules are not emitted
  const cityRulesMax = 15; // city_in_title (8) + city_in_headings (7)
  const maxPossible = cityForCheck.length > 0 ? 25 : 25 - cityRulesMax;

  const rules: ScoredCondition[] = [
    {
      points: 10,
      condition: locationClearlyStated,
      category: "local",
      confidence: "medium",
      ruleId: "location_mention",
      sourceSignal: "location_mention",
      strengthLabel: "Location clearly mentioned",
      strengthDetail: "City or location reference detected in prominent page positions.",
      strengthEvidence: "Location language detected in title, meta, or H1 (e.g. city+state pattern, or 'serving', 'located in').",
      gapLabel: "Location not clearly stated",
      gapDetail: "AI assistants use location signals to match businesses to \"near me\" and city-specific queries.",
      gapEvidence: "No city/state pattern or location language detected in title, meta description, or H1.",
    },
  ];

  // Only emit city-specific rules when city is known — avoids unevaluatable gap findings
  if (cityForCheck.length > 0) {
    rules.push({
      points: 8,
      condition: cityInTitle,
      category: "local",
      confidence: "high",
      ruleId: "city_in_title",
      sourceSignal: "city_in_title",
      strengthLabel: "City name in title tag",
      strengthDetail: `"${formInput.city}" appears in the page title, a strong local signal.`,
      strengthEvidence: `"${formInput.city}" found in page <title> tag.`,
      gapLabel: "City not in title tag",
      gapDetail: `Adding "${formInput.city}" to your title tag is one of the easiest local relevance wins.`,
      gapEvidence: `"${formInput.city}" not found in the page <title> tag.`,
    });
    rules.push({
      points: 7,
      condition: cityInHeadings,
      category: "local",
      confidence: "high",
      ruleId: "city_in_headings",
      sourceSignal: "city_in_headings",
      strengthLabel: "Location mentioned in headings",
      strengthDetail: "Local geographic context appears in page headings.",
      strengthEvidence: `"${formInput.city}" found in H1 or H2 headings.`,
      gapLabel: "City not in page headings",
      gapDetail: "Include your city/region in at least one H1 or H2 to strengthen local AI relevance.",
      gapEvidence: `"${formInput.city}" not found in any H1 or H2 heading.`,
    });
  }

  const { rawScore, findings } = applyRules(rules, maxPossible, sourceUrl);
  return { score: rawScore, findings };
}

// ── Sub-score: Trust Signals (max 25 pts) ────────────────────────────────────

function scoreTrustSignals(
  a: WebsiteAnalysis,
  sourceUrl?: string,
  businessFeatures?: BusinessFeatures,
  profile?: BusinessProfile | null
): { score: number; findings: Finding[] } {
  // Credential rule is elevated to high confidence for regulated/credentialed businesses
  const isRegulated = businessFeatures?.requiresCredentials ?? false;
  const isHospitality = profile?.sector === "hospitality" || profile?.business_model === "accommodation";

  const credentialConfidence: FindingConfidence = isRegulated ? "high" : "medium";

  // Hotels use brand affiliation / ratings / policy clarity instead of license/insured language.
  // Do not penalize hotels for missing professional-service trust markers.
  const credentialGapDetail = isHospitality
    ? "Adding brand affiliation, guest ratings, or a best-rate guarantee helps AI trust your property listing."
    : isRegulated
    ? "License and insurance credentials are expected in your industry — AI systems treat their absence as a significant trust gap."
    : 'Mentioning licensing, certifications, or guarantees ("licensed & insured") significantly boosts AI trust scoring.';
  const credentialStrengthLabel = isHospitality
    ? "Brand / trust indicators present"
    : "Professional trust indicators";
  const credentialGapLabel = isHospitality
    ? "No brand or trust indicators detected"
    : "No professional trust indicators";

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
      strengthLabel: credentialStrengthLabel,
      strengthDetail: isHospitality
        ? "Trust indicators (ratings, awards, guarantees) detected on the page."
        : "Words like licensed, certified, insured, or guaranteed were detected.",
      strengthEvidence: isHospitality
        ? 'Brand/trust language found (e.g. "award", "guarantee", "certified", "accredited").'
        : 'Professional credential language found (e.g. "licensed", "certified", "insured", "accredited").',
      gapLabel: credentialGapLabel,
      gapDetail: credentialGapDetail,
      gapEvidence: isHospitality
        ? 'No trust indicators found (brand award mentions, best-rate guarantee, or certification language).'
        : 'No credential language found ("licensed", "certified", "insured", "accredited", "guaranteed", "BBB").',
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
 * Accepts optional BusinessProfile to apply sector-specific score weights.
 */
export function scoreWebsite(
  analysis: WebsiteAnalysis,
  formInput: ReportFormInput,
  profile: BusinessProfile | null = null,
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

  // For no-URL reports, give partial local relevance credit when city is known
  if (analysis.fetchError === "no_url_provided") {
    const cityKnown = (formInput.city ?? "").trim().length > 0;
    const localRelevanceScore = cityKnown ? 20 : 0;
    const weights = SECTOR_WEIGHTS[profile?.sector ?? ""] ?? DEFAULT_WEIGHTS;
    const overallScore = cityKnown
      ? Math.round(localRelevanceScore * weights.localRelevance)
      : 0;

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
    if (cityKnown) {
      noUrlFindings.push({
        type: "strength",
        category: "local",
        label: "Location known",
        detail: `Business location is confirmed in ${formInput.city}.`,
        confidence: "high",
        evidence: `City provided: "${formInput.city}"`,
        sourceSignal: "city_known",
        ruleId: "city_known",
      });
    }
    return {
      scores: {
        overallScore,
        contentClarityScore: 0,
        serviceSpecificityScore: 0,
        localRelevanceScore,
        trustSignalScore: 0,
        faqDiscoverabilityScore: 0,
      },
      findings: noUrlFindings,
    };
  }

  const clarity = scoreContentClarity(analysis, sourceUrl);
  const service = scoreServiceSpecificity(analysis, formInput, sourceUrl, businessFeatures, profile);
  const local = scoreLocalRelevance(analysis, formInput, sourceUrl);
  const trust = scoreTrustSignals(analysis, sourceUrl, businessFeatures, profile);
  const faq = scoreFaqDiscoverability(analysis, sourceUrl);

  // Apply sector-specific weights (falls back to DEFAULT_WEIGHTS when sector is null)
  const weights = SECTOR_WEIGHTS[profile?.sector ?? ""] ?? DEFAULT_WEIGHTS;

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

// ── Recommendation rule engine ────────────────────────────────────────────────

interface RecRule {
  id: string;
  trigger: (
    profile: BusinessProfile | null,
    analysis: WebsiteAnalysis,
    features: BusinessFeatures | undefined,
    gaps: Finding[]
  ) => boolean;
  title: string;
  description: string;
  /** When present, overrides title/description with model-specific text */
  resolve?: (
    profile: BusinessProfile | null,
    analysis: WebsiteAnalysis,
    features: BusinessFeatures | undefined
  ) => { title: string; description: string };
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}

function hasGap(gaps: Finding[], ruleId: string): boolean {
  return gaps.some((g) => g.ruleId === ruleId);
}
function hasModel(profile: BusinessProfile | null, model: string): boolean {
  return profile?.offering_model.includes(model) ?? false;
}
function hasAttr(profile: BusinessProfile | null, attr: string): boolean {
  return profile?.attributes.includes(attr) ?? false;
}

const REC_RULES: RecRule[] = [
  {
    id: "menu_based_no_pricing",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "menu_based") &&
      p?.business_model !== "accommodation" && // hotels use bookable_rooms_no_pricing instead
      hasGap(gaps, "pricing_language"),
    title: "Add prices to your menu",
    description:
      "Displaying prices builds trust and helps AI match your business to budget-specific searches. Even approximate ranges work.",
    impact: "high",
    effort: "low",
  },
  {
    id: "menu_based_no_hours",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "menu_based") &&
      p?.business_model !== "accommodation" && // hotels use physical_location_no_hours instead
      hasGap(gaps, "hours_present"),
    title: "Display your hours prominently",
    description:
      "Hours are critical — customers ask AI assistants 'is [business] open now?' constantly. Put your hours in the header or hero section.",
    impact: "high",
    effort: "low",
  },
  {
    id: "menu_based_no_faq",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "menu_based") &&
      p?.business_model !== "accommodation" && // hotel FAQ content is different from dining FAQ
      hasGap(gaps, "faq_present"),
    title: "Add a menu/ordering FAQ",
    description:
      "Common questions like 'Do you take reservations?', 'Is there parking?', 'Do you offer takeout?' are frequently asked to AI assistants. A FAQ page lets AI answer these for you.",
    impact: "medium",
    effort: "low",
  },
  {
    id: "no_offering_content",
    trigger: (_p, _a, _f, gaps) => hasGap(gaps, "offering_content_present"),
    title: "Create dedicated offering pages",
    description:
      "Add pages that detail your services, menu, or products to improve AI discoverability.",
    resolve: (p, _a, _f) => {
      const config = p ? BUSINESS_MODEL_CONFIGS[p.business_model] : null;
      return config?.offeringContentRec ?? {
        title: "Create dedicated offering pages",
        description:
          "Add pages that detail your services, menu, or products to improve AI discoverability.",
      };
    },
    impact: "high",
    effort: "medium",
  },
  {
    id: "service_area_no_location",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "service_area_business") && hasGap(gaps, "location_mention"),
    title: "Add a service area page",
    description:
      "Home service customers search by location. Create a 'Service Area' page listing every city and neighborhood you cover. This is a primary AI signal for matching 'near me' searches.",
    impact: "high",
    effort: "low",
  },
  {
    id: "service_area_no_quote",
    trigger: (p, _a, f, gaps) =>
      hasModel(p, "service_area_business") &&
      !(f?.hasQuoteIntent) &&
      hasGap(gaps, "pricing_language"),
    title: "Add a free estimate call-to-action",
    description:
      "Add a prominent 'Free Estimate' or 'Get a Quote' button to your homepage and service pages. Customers searching for estimates expect to see this CTA — AI assistants use its presence to recommend you for those queries.",
    impact: "high",
    effort: "low",
  },
  {
    id: "consultation_based_no_trust",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "consultation_based") && hasGap(gaps, "trust_keywords_present"),
    title: "Display your credentials",
    description:
      "List your licenses, certifications, years of experience, and any awards. AI systems use credential language to recommend professional service providers.",
    impact: "high",
    effort: "low",
  },
  {
    id: "bookable_rooms_no_pricing",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "bookable_rooms") && hasGap(gaps, "pricing_language"),
    title: "Add room rates and pricing",
    description:
      "Guests want to see rates before booking. Adding room rates to your website helps AI answer pricing questions and improves conversion.",
    impact: "high",
    effort: "low",
  },
  {
    id: "physical_location_no_hours",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "physical_location") && hasGap(gaps, "hours_present"),
    title: "Add your business hours",
    description:
      "Display your operating hours clearly on your homepage and Contact page. This helps AI answer 'are they open now?' queries about your business.",
    impact: "medium",
    effort: "low",
  },
  {
    id: "physical_location_no_contact",
    trigger: (p, _a, _f, gaps) =>
      hasModel(p, "physical_location") && hasGap(gaps, "contact_info_present"),
    title: "Make address and contact prominent",
    description:
      "Ensure your phone number and email appear in the header, footer, and Contact page. Click-to-call phone numbers also improve mobile conversion.",
    impact: "medium",
    effort: "low",
  },
  {
    id: "any_no_faq",
    trigger: (_p, _a, _f, gaps) => hasGap(gaps, "faq_present"),
    title: "Add a FAQ section",
    description:
      "A FAQ section is the highest-impact change for AI discoverability. AI assistants frequently pull FAQ content directly to answer user questions. Write 6–10 questions your customers actually ask.",
    impact: "high",
    effort: "low",
  },
  {
    id: "any_no_testimonials",
    trigger: (_p, _a, _f, gaps) => hasGap(gaps, "testimonials_present"),
    title: "Embed customer reviews",
    description:
      "Add 3–5 real customer testimonials directly on your homepage and service pages. AI systems use on-site review content to confirm business quality.",
    impact: "medium",
    effort: "low",
  },
  {
    id: "any_no_city_in_title",
    trigger: (_p, _a, _f, gaps) => hasGap(gaps, "city_in_title"),
    title: "Add your city to the page title",
    description:
      "Update your title tag to include your city name (e.g., \"Best Plumber in Denver | Smith Plumbing\"). This is a 5-minute change with significant AI visibility impact.",
    impact: "high",
    effort: "low",
  },
  {
    id: "licensed_no_trust",
    trigger: (p, _a, _f, gaps) =>
      hasAttr(p, "licensed") && hasGap(gaps, "trust_keywords_present"),
    title: "Display your license and credentials",
    description:
      "Display your license number, insurance status, and any certifications prominently — ideally in your header or footer. Customers expect to see credentials before calling, and AI systems weight their presence heavily.",
    impact: "high",
    effort: "low",
  },
];

/**
 * Generate prioritized recommendations from gap findings.
 * Uses a profile-aware rule engine — rules fire based on offering_model,
 * attributes, and which gap ruleIds are present. Returns top 5.
 */
export function generateRecommendations(
  findings: Finding[],
  analysis: WebsiteAnalysis,
  profile: BusinessProfile | null = null,
  businessFeatures?: BusinessFeatures
): Array<{
  priority: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}> {
  const gaps = findings.filter((f) => f.type === "gap");

  const impactOrder: Record<"high" | "medium" | "low", number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const seenIds = new Set<string>();
  const seenTitles = new Set<string>(); // deduplicate by normalized title
  const recs: Array<{
    priority: number;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    effort: "high" | "medium" | "low";
  }> = [];

  for (const rule of REC_RULES) {
    if (seenIds.has(rule.id)) continue;
    if (rule.trigger(profile, analysis, businessFeatures, gaps)) {
      seenIds.add(rule.id);
      const { title, description } = rule.resolve
        ? rule.resolve(profile, analysis, businessFeatures)
        : { title: rule.title, description: rule.description };
      const normalizedTitle = title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) continue; // skip exact-title duplicates
      seenTitles.add(normalizedTitle);
      recs.push({
        priority: 0,
        title,
        description,
        impact: rule.impact,
        effort: rule.effort,
      });
    }
  }

  recs.sort((a, b) => {
    const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
    if (impactDiff !== 0) return impactDiff;
    return impactOrder[a.effort] - impactOrder[b.effort];
  });

  return recs.slice(0, 5).map((r, i) => ({ ...r, priority: i + 1 }));
}
