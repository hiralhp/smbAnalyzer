// ─────────────────────────────────────────────────────────────────────────────
// Grok Enhancer
//
// Takes the normalized deterministic report object and returns Grok-generated
// narrative enhancements. Non-blocking: returns null on any failure so the
// report always renders from deterministic content.
//
// BOUNDARY RULES — never relax these:
//   Grok may improve:   prose, wording, narrative clarity, tone
//   Grok must not touch: canonical_business_name, canonical_category, subtype,
//                        canonical_location, detected_signals, scores,
//                        findings, or deterministic recommendation ranking
//
// This module never receives raw HTML. It only consumes the structured
// GrokEnhancementInput built from pipeline outputs.
// ─────────────────────────────────────────────────────────────────────────────

import type { GrokEnhancementInput, GrokEnhancement, LlmProvider } from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import { buildGrokEnhancementPrompt } from "@/lib/prompts/grok-enhancement";
import { isGroqQuotaError } from "@/lib/errors";

/**
 * Call Grok to enhance the deterministic report with polished narrative content.
 *
 * Returns null when:
 * - XAI_API_KEY is not set
 * - MOCK_LLM=true
 * - Grok API call fails or times out
 * - Response JSON cannot be parsed
 *
 * The pipeline must always fall back to deterministic content when this returns null.
 */
export async function enhanceWithGrok(
  input: GrokEnhancementInput,
  providerOverride?: LlmProvider
): Promise<GrokEnhancement | null> {
  if (process.env.MOCK_LLM === "true") return null;
  if (process.env.AI_ENHANCEMENT_ENABLED === "false") return null;
  const provider = providerOverride ?? getLlmProvider();

  const { system, user } = buildGrokEnhancementPrompt(input);

  let rawResponse: string;
  try {
    rawResponse = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 3000,
      temperature: 0.3,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.error("[Grok Enhancer] API call failed:", err);
    return null;
  }

  try {
    const parsed = JSON.parse(rawResponse) as GrokEnhancement;

    // Basic validation — ensure we got at least one enhancement field
    const hasContent =
      parsed.enhanced_positioning_summary ||
      parsed.enhanced_recommendation_explanations ||
      parsed.enhanced_faq_answers;

    if (!hasContent) {
      console.warn("[Grok Enhancer] Response had no enhancement fields — discarding");
      return null;
    }

    return parsed;
  } catch (parseErr) {
    console.error("[Grok Enhancer] JSON parse failed:", parseErr);
    console.error("[Grok Enhancer] Raw response:", rawResponse);
    return null;
  }
}
