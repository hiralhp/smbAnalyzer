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
  LlmReportSummary,
  ReportFormInput,
} from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import {
  buildReportSummaryPrompt,
} from "@/lib/prompts/report-summary";

export async function generateLlmSummary(
  formInput: ReportFormInput,
  websiteAnalysis: WebsiteAnalysis,
  scores: ScoreBreakdown,
  findings: Finding[]
): Promise<LlmReportSummary> {
  const strengths = findings.filter((f) => f.type === "strength");
  const gaps = findings.filter((f) => f.type === "gap");

  const { system, user } = buildReportSummaryPrompt({
    formInput,
    websiteAnalysis,
    scores,
    strengths,
    gaps,
  });

  const provider = getLlmProvider();

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
    console.error("[LLM Summarizer] Failed:", err);
    // Return a graceful fallback so the report still renders
    return buildFallbackSummary(formInput, strengths, gaps);
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
    return buildFallbackSummary(formInput, strengths, gaps);
  }
}

/**
 * Rule-based fallback summary when LLM is unavailable or fails.
 * Ensures the report still renders with useful content.
 */
function buildFallbackSummary(
  formInput: ReportFormInput,
  strengths: Finding[],
  gaps: Finding[]
): LlmReportSummary {
  const businessName = formInput.businessName;
  const city = formInput.city ? ` in ${formInput.city}` : "";
  const category = formInput.category ? ` (${formInput.category})` : "";

  return {
    positioningSummary: `${businessName}${category} has a web presence${city} with some established signals, but there are clear opportunities to improve how AI systems discover and understand the business. Addressing the identified gaps will meaningfully increase visibility in AI-powered search results.`,
    topStrengths: strengths.slice(0, 3).map((s) => s.label),
    topOpportunities: gaps.slice(0, 3).map((g) => g.detail ?? g.label),
    contentAssetType: gaps.some((g) => g.category === "faq") ? "faq" : "none",
    contentAssetDraft: "",
  };
}
