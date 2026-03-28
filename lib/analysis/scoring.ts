// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Scoring Engine
//
// Takes a WebsiteAnalysis and returns a ScoreBreakdown + list of Findings.
// No LLM calls here — pure rule-based logic.
//
// Each sub-score is computed independently, then combined into an overall score.
// Rules are defined as arrays of scored conditions for easy extension.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WebsiteAnalysis,
  ScoreBreakdown,
  Finding,
  FindingCategory,
  ReportFormInput,
} from "@/lib/types";

// ── Score rule helpers ────────────────────────────────────────────────────────

interface ScoredCondition {
  points: number;
  condition: boolean;
  /** If true, adds to score. If false, produces a gap finding. */
  strengthLabel?: string;
  strengthDetail?: string;
  gapLabel?: string;
  gapDetail?: string;
  category: FindingCategory;
}

function applyRules(
  rules: ScoredCondition[],
  maxPossible: number
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
        });
      }
    } else {
      if (rule.gapLabel) {
        findings.push({
          type: "gap",
          category: rule.category,
          label: rule.gapLabel,
          detail: rule.gapDetail,
        });
      }
    }
  }

  // Normalize to 0–100
  const normalized = Math.round((rawScore / maxPossible) * 100);
  return { rawScore: Math.min(100, Math.max(0, normalized)), findings };
}

// ── Sub-score: Content Clarity (max 40 pts) ───────────────────────────────────

function scoreContentClarity(a: WebsiteAnalysis): {
  score: number;
  findings: Finding[];
} {
  const rules: ScoredCondition[] = [
    {
      points: 10,
      condition: !!a.title,
      category: "content",
      strengthLabel: "Descriptive title tag",
      strengthDetail: `Title: "${a.title}"`,
      gapLabel: "Missing title tag",
      gapDetail: "A clear title tag helps AI understand what the business is.",
    },
    {
      points: 10,
      condition: !!a.metaDescription,
      category: "content",
      strengthLabel: "Meta description present",
      strengthDetail: `"${a.metaDescription?.slice(0, 80)}..."`,
      gapLabel: "No meta description",
      gapDetail:
        "A meta description gives AI a concise business summary.",
    },
    {
      points: 10,
      condition: a.h1Headings.length > 0,
      category: "content",
      strengthLabel: "Clear H1 heading",
      strengthDetail: `H1: "${a.h1Headings[0]}"`,
      gapLabel: "No H1 heading detected",
      gapDetail: "H1 headings are a primary signal for AI topic extraction.",
    },
    {
      points: 10,
      condition: a.h2Headings.length >= 3,
      category: "content",
      strengthLabel: "Multiple H2 section headings",
      strengthDetail: `Found ${a.h2Headings.length} section headings, improving content structure.`,
      gapLabel: "Insufficient content structure (few H2 headings)",
      gapDetail:
        "Adding H2 headings for each major topic area improves AI comprehension.",
    },
  ];

  const { rawScore, findings } = applyRules(rules, 40);
  return { score: rawScore, findings };
}

// ── Sub-score: Service Specificity (max 30 pts) ───────────────────────────────

function scoreServiceSpecificity(
  a: WebsiteAnalysis,
  formInput: ReportFormInput
): { score: number; findings: Finding[] } {
  const servicesProvided = (formInput.topServices ?? []).length > 0;

  const rules: ScoredCondition[] = [
    {
      points: 15,
      condition: a.hasServicePages,
      category: "service",
      strengthLabel: "Dedicated service pages detected",
      strengthDetail:
        "Individual service pages help AI recommend you for specific queries.",
      gapLabel: "No dedicated service pages",
      gapDetail:
        "Creating separate pages for each service dramatically improves AI discoverability for specific service queries.",
    },
    {
      points: 10,
      condition: servicesProvided && a.h2Headings.some((h) =>
        (formInput.topServices ?? []).some((s) =>
          h.toLowerCase().includes(s.toLowerCase())
        )
      ),
      category: "service",
      strengthLabel: "Services mentioned in headings",
      strengthDetail: "Service names appear in H2 headings, signaling service content to AI.",
      gapLabel: "Services not prominent in headings",
      gapDetail:
        "Mention your specific services in H2 headings so AI can surface them in responses.",
    },
    {
      points: 5,
      condition: a.hasPricing,
      category: "service",
      strengthLabel: "Pricing language present",
      strengthDetail: "Pricing context helps AI qualify your business for budget-aware queries.",
      gapLabel: "No pricing language detected",
      gapDetail:
        "Adding pricing context (even ranges) helps AI match your business to intent-specific searches.",
    },
  ];

  const { rawScore, findings } = applyRules(rules, 30);
  return { score: rawScore, findings };
}

// ── Sub-score: Local Relevance (max 25 pts) ───────────────────────────────────

function scoreLocalRelevance(
  a: WebsiteAnalysis,
  formInput: ReportFormInput
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
      strengthLabel: "Location clearly mentioned",
      strengthDetail: "City or location reference detected in prominent page positions.",
      gapLabel: "Location not clearly stated",
      gapDetail:
        "AI assistants use location signals to match businesses to \"near me\" and city-specific queries.",
    },
    {
      points: 8,
      condition: cityInTitle,
      category: "local",
      strengthLabel: "City name in title tag",
      strengthDetail: `"${formInput.city}" appears in the page title, a strong local signal.`,
      gapLabel: "City not in title tag",
      gapDetail:
        `Adding "${formInput.city}" to your title tag is one of the easiest local relevance wins.`,
    },
    {
      points: 7,
      condition: cityInHeadings,
      category: "local",
      strengthLabel: "Location mentioned in headings",
      strengthDetail: "Local geographic context appears in page headings.",
      gapLabel: "City not in page headings",
      gapDetail:
        "Include your city/region in at least one H1 or H2 to strengthen local AI relevance.",
    },
  ];

  const { rawScore, findings } = applyRules(rules, 25);
  return { score: rawScore, findings };
}

// ── Sub-score: Trust Signals (max 25 pts) ────────────────────────────────────

function scoreTrustSignals(a: WebsiteAnalysis): {
  score: number;
  findings: Finding[];
} {
  const rules: ScoredCondition[] = [
    {
      points: 8,
      condition: a.hasContactInfo,
      category: "trust",
      strengthLabel: "Contact information present",
      strengthDetail: "Phone number or email address detected on the page.",
      gapLabel: "No contact information detected",
      gapDetail:
        "Visible contact details are a basic trust signal AI systems use to verify legitimacy.",
    },
    {
      points: 7,
      condition: a.hasTestimonials,
      category: "trust",
      strengthLabel: "Customer testimonials embedded",
      strengthDetail: "Review or testimonial content detected on the site.",
      gapLabel: "No embedded reviews or testimonials",
      gapDetail:
        "Customer reviews embedded directly on your site (not just Google) strengthen AI trust signals.",
    },
    {
      points: 6,
      condition: a.hasTrustSignals,
      category: "trust",
      strengthLabel: "Professional trust indicators",
      strengthDetail:
        "Words like licensed, certified, insured, or guaranteed were detected.",
      gapLabel: "No professional trust indicators",
      gapDetail:
        'Mentioning licensing, certifications, or guarantees ("licensed & insured") significantly boosts AI trust scoring.',
    },
    {
      points: 4,
      condition: a.hasHours,
      category: "trust",
      strengthLabel: "Business hours mentioned",
      strengthDetail:
        "Operating hours help AI assistants answer availability questions about your business.",
      gapLabel: "No business hours detected",
      gapDetail:
        "Adding operating hours helps AI answer questions like \"Are they open now?\"",
    },
  ];

  const { rawScore, findings } = applyRules(rules, 25);
  return { score: rawScore, findings };
}

// ── Sub-score: FAQ / Discoverability (max 20 pts) ────────────────────────────

function scoreFaqDiscoverability(a: WebsiteAnalysis): {
  score: number;
  findings: Finding[];
} {
  const rules: ScoredCondition[] = [
    {
      points: 15,
      condition: a.hasFaq,
      category: "faq",
      strengthLabel: "FAQ section detected",
      strengthDetail:
        "FAQ content helps AI surface direct answers about your business.",
      gapLabel: "No FAQ section detected",
      gapDetail:
        "A FAQ section is the single highest-impact change for AI discoverability. AI assistants frequently pull FAQ content to answer user questions.",
    },
    {
      points: 5,
      condition: a.h2Headings.length >= 5,
      category: "faq",
      strengthLabel: "Rich content structure",
      strengthDetail: `${a.h2Headings.length} H2 headings provide strong topical coverage.`,
      gapLabel: "Limited topical depth",
      gapDetail:
        "Expand content depth with more structured sections to improve topical coverage for AI.",
    },
  ];

  const { rawScore, findings } = applyRules(rules, 20);
  return { score: rawScore, findings };
}

// ── Main scoring function ────────────────────────────────────────────────────

/**
 * Run all scoring rules against a WebsiteAnalysis and return scores + findings.
 * Deterministic — no LLM calls.
 */
export function scoreWebsite(
  analysis: WebsiteAnalysis,
  formInput: ReportFormInput
): { scores: ScoreBreakdown; findings: Finding[] } {
  if (analysis.fetchError) {
    // Website couldn't be fetched — return zeroes with a single gap finding
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
        },
      ],
    };
  }

  const clarity = scoreContentClarity(analysis);
  const service = scoreServiceSpecificity(analysis, formInput);
  const local = scoreLocalRelevance(analysis, formInput);
  const trust = scoreTrustSignals(analysis);
  const faq = scoreFaqDiscoverability(analysis);

  // Weighted overall score
  // Weights: content 25%, service 20%, local 20%, trust 20%, faq 15%
  const overallScore = Math.round(
    clarity.score * 0.25 +
      service.score * 0.2 +
      local.score * 0.2 +
      trust.score * 0.2 +
      faq.score * 0.15
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
 * Returns up to 5 recommendations sorted by impact.
 */
export function generateRecommendations(
  findings: Finding[],
  _analysis: WebsiteAnalysis
): Array<{
  priority: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}> {
  // Map gap labels to specific recommendations
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
      description:
        "A FAQ section is the highest-impact change for AI discoverability. AI assistants frequently pull FAQ content directly to answer user questions. Write 6–10 questions your customers actually ask.",
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
      description:
        'Prominently display your license number, insurance status, certifications, or guarantees. Phrases like "Licensed, bonded & insured" directly boost AI trust signals.',
      impact: "medium",
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
      title: "Add pricing context to your site",
      description:
        'Include pricing ranges, starting prices, or at least an "affordable" or "competitive rates" statement. Pricing context helps AI match your business to budget-specific searches.',
      impact: "medium",
      effort: "low",
    },
  };

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
    const rec = gapRecs[gap.label];
    if (rec) recs.push({ ...rec, priority: 0 });
  }

  // Sort by impact, then effort (low effort first)
  recs.sort((a, b) => {
    const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
    if (impactDiff !== 0) return impactDiff;
    return impactOrder[a.effort] - impactOrder[b.effort];
  });

  // Assign priority numbers
  return recs.slice(0, 5).map((r, i) => ({ ...r, priority: i + 1 }));
}
