// ─────────────────────────────────────────────────────────────────────────────
// Groq Classifier
//
// Fast category classification using the Grok/Groq provider.
// Validates and corrects the deterministic sector classification.
//
// Non-blocking: returns null when provider unavailable or response invalid.
// ─────────────────────────────────────────────────────────────────────────────

import { getLlmProvider } from "@/lib/llm";
import { buildGroqClassificationPrompt } from "@/lib/prompts/groq-classification";
import type { GroqClassificationResult, LlmProvider, WebsiteAnalysis } from "@/lib/types";
import { isGroqQuotaError } from "@/lib/errors";

// ── Brand priors ──────────────────────────────────────────────────────────────
// Known brand → sector mappings. Applied before the LLM call so strong brand
// signals produce high-confidence classifications without a network round-trip.

interface BrandPrior {
  sector: string;
  category: string;
}

const HOTEL_BRANDS: RegExp[] = [
  /\bla quinta\b/i,
  /\bmarriott\b/i, /\bcourtyard\b/i, /\bfairfield\b/i, /\bsheraton\b/i, /\bwestin\b/i,
  /\bhilton\b/i, /\bhampton inn\b/i, /\bdoubletree\b/i, /\bhilton garden\b/i, /\bembassy suites\b/i,
  /\bhyatt\b/i, /\bpark hyatt\b/i, /\bgrand hyatt\b/i, /\bregency\b/i,
  /\bholiday inn\b/i, /\bcrowne plaza\b/i, /\bihg\b/i, /\bintercontinental\b/i,
  /\bbest western\b/i, /\bcomfort inn\b/i, /\bcomfort suites\b/i, /\bquality inn\b/i,
  /\bclarion\b/i, /\bsleep inn\b/i, /\becono lodge\b/i,
  /\bwyndham\b/i, /\bramada\b/i, /\bdays inn\b/i, /\bsuper 8\b/i, /\btravelodge\b/i,
  /\bhyatt place\b/i, /\bhyatt house\b/i, /\baloft\b/i, /\belement hotel\b/i,
  /\bac hotel\b/i, /\bmoxy\b/i, /\bfour seasons\b/i, /\britz.carlton\b/i,
  /\bwaldorf\b/i, /\bst\.\s*regis\b/i, /\bw hotel\b/i, /\bautograph collection\b/i,
  /\bmotel 6\b/i, /\bred roof\b/i, /\bcandlewood suites\b/i, /\bstaybridge\b/i,
  // Generic property-type words in the brand name
  /\binn\s*&\s*suites\b/i, /\binn and suites\b/i,
];

const FOOD_BRANDS: RegExp[] = [
  /\bmcdonald'?s\b/i, /\bsubway\b/i, /\bstarbucks\b/i, /\bdunkin\b/i,
  /\bchipotle\b/i, /\btaco bell\b/i, /\bburger king\b/i, /\bwendy'?s\b/i,
  /\bpanera\b/i, /\bdomino'?s\b/i, /\bpizza hut\b/i, /\bpapa john'?s\b/i,
  /\bchick.fil.a\b/i, /\bdairy queen\b/i, /\bzaxby'?s\b/i,
  /\bfive guys\b/i, /\bshake shack\b/i, /\bin.n.out\b/i,
];

function checkBrandPriors(businessName: string): BrandPrior | null {
  if (!businessName.trim()) return null;
  for (const pattern of HOTEL_BRANDS) {
    if (pattern.test(businessName)) {
      return { sector: "hospitality", category: "hotel" };
    }
  }
  for (const pattern of FOOD_BRANDS) {
    if (pattern.test(businessName)) {
      return { sector: "food_and_beverage", category: "restaurant" };
    }
  }
  return null;
}

const VALID_SECTORS = new Set([
  "food_and_beverage", "retail_store", "professional_services",
  "home_services", "health_wellness", "hospitality", "fitness", "unknown",
]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

/**
 * Fast category classification using the Grok provider.
 *
 * Merging rules for callers:
 *   - confidence=high:   override businessProfile.sector unconditionally
 *   - confidence=medium: override only when deterministic confidence is "low"
 *   - confidence=low:    ignore
 *
 * Returns null when:
 *   - businessName is empty
 *   - MOCK_LLM=true or no Grok key configured
 *   - LLM call throws
 *   - Response fails validation
 */
export async function classifyWithGroq(
  businessName: string,
  formCategory: string | null,
  city: string | null,
  analysis: WebsiteAnalysis,
  providerOverride?: LlmProvider
): Promise<GroqClassificationResult | null> {
  if (!businessName.trim()) return null;

  // Short-circuit: known brand priors give high-confidence results without an LLM call.
  // Also fires when MOCK_LLM=true so pipeline always gets a classification for known brands.
  const prior = checkBrandPriors(businessName);
  if (prior) {
    return {
      category: prior.category,
      sector: prior.sector,
      subtype: null,
      confidence: "high",
      reasoning: `Brand name "${businessName}" matches a known ${prior.sector} brand prior.`,
    };
  }

  if (process.env.MOCK_LLM === "true") return null;
  const provider = providerOverride ?? getLlmProvider();

  const prompt = buildGroqClassificationPrompt({
    businessName,
    formCategory,
    city,
    pageTitle: analysis.title ?? null,
    metaDescription: analysis.metaDescription ?? null,
    h1Headings: analysis.h1Headings,
    bodyTextSample: analysis.bodyTextSample ?? null,
  });

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      maxTokens: 200,
      temperature: 0,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err; // let pipeline detect quota exhaustion
    console.warn("[groq-classifier] LLM call failed:", err);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const category = typeof parsed.category === "string" ? parsed.category.trim() : null;
    const sector = typeof parsed.sector === "string" ? parsed.sector.trim() : null;
    const subtype = typeof parsed.subtype === "string" && parsed.subtype.trim()
      ? parsed.subtype.trim()
      : null;
    const confidence = typeof parsed.confidence === "string" ? parsed.confidence.trim() : null;
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";

    if (
      !category ||
      !sector ||
      !VALID_SECTORS.has(sector) ||
      !confidence ||
      !VALID_CONFIDENCE.has(confidence)
    ) {
      console.warn("[groq-classifier] Invalid response fields:", raw.slice(0, 300));
      return null;
    }

    return {
      category,
      sector,
      subtype,
      confidence: confidence as "high" | "medium" | "low",
      reasoning,
    };
  } catch {
    console.warn("[groq-classifier] Failed to parse response:", raw.slice(0, 300));
    return null;
  }
}

const VALID_FOOD_SUBTYPES = new Set([
  "restaurant", "bakery", "cafe", "bar", "food_truck", "catering", "brewery",
  "fast_food", "pizza", "sushi", "deli", "ice_cream",
]);

/**
 * Secondary LLM pass specifically for food_and_beverage subtype disambiguation.
 * Fixes the known bakery-vs-restaurant misclassification caused by overlapping keywords.
 * Only called when userApiKey is set and sector is food_and_beverage.
 */
export async function refineFoodSubtype(
  businessName: string,
  analysis: WebsiteAnalysis,
  providerOverride?: LlmProvider
): Promise<string | null> {
  if (process.env.MOCK_LLM === "true") return null;
  const provider = providerOverride ?? getLlmProvider();

  const content = [
    analysis.title,
    ...(analysis.h1Headings ?? []),
    analysis.metaDescription,
    analysis.bodyTextSample?.slice(0, 600),
  ]
    .filter(Boolean)
    .join("\n");

  if (!content.trim()) return null;

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You are a business category classifier. Respond ONLY with a JSON object containing a single 'subtype' field.",
        },
        {
          role: "user",
          content: `Business name: "${businessName}"
Website content:
"""
${content}
"""

What type of food & beverage business is this? Choose the single best subtype from:
restaurant, bakery, cafe, bar, food_truck, catering, brewery, fast_food, pizza, sushi, deli, ice_cream

Return: { "subtype": "<your choice>" }`,
        },
      ],
      maxTokens: 30,
      temperature: 0,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[groq-classifier] refineFoodSubtype LLM call failed:", err);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype.trim().toLowerCase() : null;
    if (subtype && VALID_FOOD_SUBTYPES.has(subtype)) return subtype;
    return null;
  } catch {
    return null;
  }
}
