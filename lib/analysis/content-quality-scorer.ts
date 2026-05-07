import type { Finding, LlmProvider, WebsiteAnalysis } from "@/lib/types";
import { buildContentQualityPrompt } from "@/lib/prompts/content-quality";
import { isGroqQuotaError } from "@/lib/errors";

interface QualityRating {
  score: number;
  suggestion: string;
}

interface ContentQualityResult {
  title: QualityRating;
  metaDescription: QualityRating;
  h1: QualityRating;
  bodyContent: QualityRating;
}

const QUALITY_THRESHOLD = 5; // scores below this generate gap findings

/**
 * Uses LLM to rate the actual quality of content elements (not just presence).
 * Returns Finding[] that get merged into the main findings array.
 * Non-blocking: returns [] on any failure.
 */
export async function scoreContentQualityWithLlm(
  analysis: WebsiteAnalysis,
  businessName: string | undefined,
  city: string | undefined,
  provider: LlmProvider
): Promise<Finding[]> {
  const { system, user } = buildContentQualityPrompt({
    title: analysis.title,
    metaDescription: analysis.metaDescription,
    h1Headings: analysis.h1Headings ?? [],
    bodyTextSample: analysis.bodyTextSample,
    businessName,
    city,
  });

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 600,
      temperature: 0,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[ContentQualityScorer] LLM call failed:", err);
    return [];
  }

  let result: ContentQualityResult;
  try {
    result = JSON.parse(raw) as ContentQualityResult;
    if (!result.title || !result.metaDescription || !result.h1 || !result.bodyContent) {
      return [];
    }
  } catch {
    console.warn("[ContentQualityScorer] JSON parse failed");
    return [];
  }

  const findings: Finding[] = [];

  const elements: Array<{
    key: keyof ContentQualityResult;
    label: string;
    ruleId: string;
    presentOnPage: boolean;
  }> = [
    { key: "title", label: "Page title quality", ruleId: "llm_title_quality", presentOnPage: !!analysis.title },
    { key: "metaDescription", label: "Meta description quality", ruleId: "llm_meta_quality", presentOnPage: !!analysis.metaDescription },
    { key: "h1", label: "H1 heading quality", ruleId: "llm_h1_quality", presentOnPage: (analysis.h1Headings?.length ?? 0) > 0 },
    { key: "bodyContent", label: "Body content quality", ruleId: "llm_body_quality", presentOnPage: !!analysis.bodyTextSample },
  ];

  for (const el of elements) {
    const rating = result[el.key];
    if (!el.presentOnPage) continue; // already caught by deterministic scoring
    if (typeof rating.score !== "number") continue;

    if (rating.score >= QUALITY_THRESHOLD) {
      findings.push({
        type: "strength",
        category: "content",
        label: el.label,
        detail: rating.suggestion,
        confidence: rating.score >= 8 ? "high" : "medium",
        ruleId: el.ruleId,
      });
    } else {
      findings.push({
        type: "gap",
        category: "content",
        label: el.label,
        detail: rating.suggestion,
        confidence: rating.score <= 2 ? "high" : "medium",
        ruleId: el.ruleId,
      });
    }
  }

  return findings;
}
