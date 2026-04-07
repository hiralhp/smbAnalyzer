// ─────────────────────────────────────────────────────────────────────────────
// LLM Summarizer
//
// The ONLY place in the pipeline where we call the LLM.
// Takes structured analysis data, calls the LLM once, and returns a summary.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WebsiteAnalysis,
  ScoreBreakdown,
  Finding,
  LlmProvider,
  LlmReportSummary,
  ReportFormInput,
  BusinessProfile,
} from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import { buildReportSummaryPrompt } from "@/lib/prompts/report-summary";
import { buildFaqDraft } from "@/lib/analysis/faq-generator";
import { isGroqQuotaError } from "@/lib/errors";

export async function generateLlmSummary(
  formInput: ReportFormInput,
  websiteAnalysis: WebsiteAnalysis,
  scores: ScoreBreakdown,
  findings: Finding[],
  businessProfile?: BusinessProfile | null,
  faqQuestions?: string[],
  providerOverride?: LlmProvider
): Promise<LlmReportSummary> {
  const strengths = findings.filter((f) => f.type === "strength");
  const gaps = findings.filter((f) => f.type === "gap");

  const { system, user } = buildReportSummaryPrompt({
    formInput,
    websiteAnalysis,
    scores,
    strengths,
    gaps,
    sector: businessProfile?.sector,
    subtype: businessProfile?.subtype,
    faqQuestions,
  });

  const provider = providerOverride ?? getLlmProvider();

  let rawResponse: string;
  try {
    rawResponse = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 2048,
      temperature: 0.3,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err; // let pipeline detect quota exhaustion
    console.error("[LLM Summarizer] Failed:", err);
    return buildFallbackSummary(formInput, strengths, gaps, faqQuestions);
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(rawResponse) as LlmReportSummary;
    return {
      positioningSummary: parsed.positioningSummary ?? "",
      topStrengths: parsed.topStrengths ?? [],
      topOpportunities: parsed.topOpportunities ?? [],
      contentAssetType: parsed.contentAssetType ?? "none",
      contentAssetDraft: parsed.contentAssetDraft ?? "",
    };
  } catch (parseErr) {
    console.error("[LLM Summarizer] JSON parse failed:", parseErr);
    console.error("[LLM Summarizer] Raw response:", rawResponse);
    return buildFallbackSummary(formInput, strengths, gaps, faqQuestions);
  }
}

/**
 * Rule-based fallback summary when LLM is unavailable or fails.
 * Uses category-specific FAQ questions (from generateFaqs) for the draft so the
 * content is never generic even without an LLM call.
 */
export function buildFallbackSummary(
  formInput: ReportFormInput,
  strengths: Finding[],
  gaps: Finding[],
  faqQuestions?: string[]
): LlmReportSummary {
  const businessName = formInput.businessName || "This business";
  const city = formInput.city ? ` in ${formInput.city}` : "";
  const category = formInput.category ? ` (${formInput.category})` : "";

  const hasFaqGap = gaps.some((g) => g.category === "faq");
  const contentAssetType: LlmReportSummary["contentAssetType"] = hasFaqGap ? "faq" : "none";
  // Use category-specific questions if available; otherwise leave draft empty
  const contentAssetDraft =
    hasFaqGap && faqQuestions && faqQuestions.length > 0
      ? buildFaqDraft(faqQuestions, businessName)
      : "";

  return {
    positioningSummary: `${businessName}${category} has a web presence${city} with some established signals, but there are clear opportunities to improve how AI systems discover and understand the business. Addressing the identified gaps will meaningfully increase visibility in AI-powered search results.`,
    topStrengths: strengths.slice(0, 3).map((s) => s.label),
    topOpportunities: gaps.slice(0, 3).map((g) => g.detail ?? g.label),
    contentAssetType,
    contentAssetDraft,
  };
}
