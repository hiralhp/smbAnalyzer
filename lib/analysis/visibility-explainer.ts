import type {
  LlmProvider,
  WebsiteAnalysis,
  BusinessProfile,
  VisibilitySimulationResult,
  VisibilitySimulationRow,
} from "@/lib/types";
import { buildVisibilityExplanationPrompt } from "@/lib/prompts/visibility-explanation";
import { isGroqQuotaError } from "@/lib/errors";

/**
 * Uses LLM to explain why the business didn't appear for certain queries.
 * Returns a map of query → explanation string.
 * Non-blocking: returns {} on any failure.
 */
export async function explainVisibilityGaps(
  result: VisibilitySimulationResult,
  rows: VisibilitySimulationRow[],
  analysis: WebsiteAnalysis,
  businessProfile: BusinessProfile,
  provider: LlmProvider
): Promise<Record<string, string>> {
  const missingRows = rows.filter((r) => !r.analyzedBusinessAppears);
  if (missingRows.length === 0) return {};

  const business = {
    name: result.analyzedBusinessName,
    sector: businessProfile.sector ?? "business",
    city: analysis.city ?? "",
    hasLocationMention: analysis.hasLocationMention ?? false,
    hasPricing: analysis.hasPricing ?? false,
    hasTrustSignals: analysis.hasTrustSignals ?? false,
    hasServicePages: analysis.hasServicePages ?? false,
    hasFaq: analysis.hasFaq ?? false,
  };

  const { system, user } = buildVisibilityExplanationPrompt(missingRows, business);

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 800,
      temperature: 0.2,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[VisibilityExplainer] LLM call failed:", err);
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    const explanations: Record<string, string> = {};
    for (const item of parsed) {
      if (typeof item.query === "string" && typeof item.explanation === "string") {
        explanations[item.query] = item.explanation;
      }
    }
    return explanations;
  } catch {
    console.warn("[VisibilityExplainer] JSON parse failed");
    return {};
  }
}
