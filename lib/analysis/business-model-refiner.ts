// ─────────────────────────────────────────────────────────────────────────────
// Business Model LLM Refiner
//
// Lightweight LLM fallback that fires only when business_model === "unknown"
// AND profile.confidence === "low". Sends a minimal prompt (title + H1s) to
// classify into one of the 6 known business models.
//
// On any error, returns the original profile unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { BusinessProfile, BusinessModel, WebsiteAnalysis, LlmProvider } from "@/lib/types";

const VALID_MODELS: BusinessModel[] = [
  "venue_experience",
  "accommodation",
  "transactional_service",
  "appointment_based",
  "retail_product",
  "professional_advisory",
];

/**
 * Attempt to refine an "unknown" business_model using a minimal LLM call.
 * Only fires when business_model === "unknown" AND confidence === "low".
 * Gracefully returns original profile on any error.
 */
export async function refineBusinessModelWithLlm(
  profile: BusinessProfile,
  analysis: WebsiteAnalysis,
  provider: LlmProvider
): Promise<BusinessProfile> {
  if (profile.business_model !== "unknown" || profile.confidence !== "low") {
    return profile;
  }

  const title = analysis.title ?? "(no title)";
  const h1s = (analysis.h1Headings ?? []).slice(0, 3).join(", ") || "(none)";

  try {
    const response = await provider.complete({
      messages: [
        {
          role: "user",
          content: `Classify this business into exactly one of these values:
venue_experience, accommodation, transactional_service, appointment_based, retail_product, professional_advisory

Page title: ${title}
H1 headings: ${h1s}

Respond with only one of those exact values and nothing else.`,
        },
      ],
      maxTokens: 20,
      temperature: 0,
    });

    const cleaned = response.trim().toLowerCase().replace(/[^a-z_]/g, "") as BusinessModel;
    if (VALID_MODELS.includes(cleaned)) {
      return {
        ...profile,
        business_model: cleaned,
        matched_rules: [...profile.matched_rules, "llm_refined"],
      };
    }
  } catch {
    // LLM failed — return original profile unchanged
  }

  return profile;
}
