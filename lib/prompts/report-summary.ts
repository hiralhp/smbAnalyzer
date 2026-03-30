// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Report Summary Generation
//
// Used ONCE per report to generate the positioning summary, strengths,
// opportunities, recommendations, and one content asset draft.
//
// Input: structured JSON analysis result (no raw HTML)
// Output: strict JSON matching LlmReportSummary
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis, ScoreBreakdown, Finding, ReportFormInput } from "@/lib/types";

export interface ReportSummaryPromptContext {
  formInput: ReportFormInput;
  websiteAnalysis: WebsiteAnalysis;
  scores: ScoreBreakdown;
  strengths: Finding[];
  gaps: Finding[];
  /** Canonical sector (e.g. "food_and_beverage") for category-specific content */
  sector?: string | null;
  /** Canonical subtype (e.g. "restaurant", "cafe_coffee_shop") for finer targeting */
  subtype?: string | null;
  /** Pre-generated category-specific FAQ questions — LLM should write answers for these */
  faqQuestions?: string[];
}

export function buildReportSummaryPrompt(ctx: ReportSummaryPromptContext): {
  system: string;
  user: string;
} {
  const system = `You are a business intelligence analyst specializing in AI discoverability for small businesses.

Your job is to analyze structured data about a business's web presence and produce a useful, specific, actionable report.

IMPORTANT RULES:
- Do NOT assume the business is failing or doing poorly
- Do NOT give generic SEO advice (no "use keywords", "optimize for Google")
- Focus on AI discoverability: how clearly AI systems can understand and recommend this business
- Be specific to THIS business, its category, and location
- Tone: professional, constructive, specific

You MUST respond with valid JSON only. No markdown fences. No commentary outside JSON.

JSON schema:
{
  "positioningSummary": "2-3 sentence paragraph describing current positioning for AI discovery",
  "topStrengths": ["strength 1", "strength 2", "strength 3"],
  "topOpportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "contentAssetType": "faq" | "service_page" | "homepage_copy" | "review_request" | "none",
  "contentAssetDraft": "The full content draft as plain text or markdown"
}`;

  const user = `Here is the structured analysis for this business. Produce the report summary JSON.

## Business Info
- Name: ${ctx.formInput.businessName || "Not specified"}
- Category: ${ctx.formInput.category || "Not specified"}
- Detected Sector: ${ctx.sector ?? "Not detected"}
- Detected Subtype: ${ctx.subtype ?? "Not detected"}
- Location: ${ctx.formInput.city || "Not specified"}
- Website: ${ctx.formInput.websiteUrl || "Not provided"}
- Top Services: ${ctx.formInput.topServices?.join(", ") || "Not specified"}

## AI Readiness Scores (0–100)
- Overall: ${ctx.scores.overallScore}
- Content Clarity: ${ctx.scores.contentClarityScore}
- Service Specificity: ${ctx.scores.serviceSpecificityScore}
- Local Relevance: ${ctx.scores.localRelevanceScore}
- Trust Signals: ${ctx.scores.trustSignalScore}
- FAQ / Discoverability: ${ctx.scores.faqDiscoverabilityScore}

## Website Signals Detected
- Title: ${ctx.websiteAnalysis.title || "None found"}
- Meta description: ${ctx.websiteAnalysis.metaDescription || "None found"}
- H1 headings: ${ctx.websiteAnalysis.h1Headings.join(" | ") || "None"}
- H2 headings: ${ctx.websiteAnalysis.h2Headings.slice(0, 5).join(" | ") || "None"}
- Has service pages: ${ctx.websiteAnalysis.hasServicePages}
- Has FAQ: ${ctx.websiteAnalysis.hasFaq}
- Has location mention: ${ctx.websiteAnalysis.hasLocationMention}
- Has trust signals: ${ctx.websiteAnalysis.hasTrustSignals}
- Has contact info: ${ctx.websiteAnalysis.hasContactInfo}
- Has hours: ${ctx.websiteAnalysis.hasHours}
- Has pricing language: ${ctx.websiteAnalysis.hasPricing}
- Has testimonials: ${ctx.websiteAnalysis.hasTestimonials}

## Detected Strengths
${ctx.strengths.map((s) => `- ${s.label}: ${s.detail || ""}`).join("\n") || "None detected"}

## Detected Gaps
${ctx.gaps.map((g) => `- ${g.label}: ${g.detail || ""}`).join("\n") || "None detected"}

## Body Text Sample
${ctx.websiteAnalysis.bodyTextSample?.slice(0, 600) || "Not available"}

---

Choose the most impactful contentAssetType based on the biggest gap detected.
For the contentAssetDraft, write the FULL content asset (not just a description of it).
${ctx.faqQuestions && ctx.faqQuestions.length > 0
  ? `If contentAssetType is "faq", write answers for EXACTLY these category-specific questions (do not substitute generic questions):
${ctx.faqQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
  : `If contentAssetType is "faq", write 5–8 realistic Q&A pairs specific to this business category and location.`}
If contentAssetType is "service_page", write a complete service page outline with sections and copy.
If contentAssetType is "homepage_copy", write a full homepage hero + value proposition block.
If contentAssetType is "review_request", write a short personalized message asking a happy customer for a review.

Respond with JSON only.`;

  return { system, user };
}
