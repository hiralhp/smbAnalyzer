// ─────────────────────────────────────────────────────────────────────────────
// Signal Extractor
//
// Uses the base LLM to classify the 10 boolean signals from scraped website
// content. These signals can supplement the deterministic scraper signals in
// detectWebsitePattern() via OR-merge.
//
// Returns null when:
// - MOCK_LLM=true (MockProvider returns non-JSON)
// - LLM call fails
// - Response JSON is missing any required field
// - No meaningful content to analyze
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis, LlmExtractedSignals, LlmProvider } from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import { isGroqQuotaError } from "@/lib/errors";
import { buildSignalExtractionPrompt } from "@/lib/prompts/signal-extraction";

const REQUIRED_FIELDS: Array<keyof LlmExtractedSignals> = [
  "has_pricing",
  "mentions_integrations",
  "mentions_booking",
  "mentions_physical_location",
  "mentions_menu",
  "mentions_appointments",
  "mentions_rooms_or_stays",
  "mentions_products_for_sale",
  "mentions_content_or_blog",
  "mentions_contact_info",
];

/**
 * Call the base LLM to extract the 10 routing signals from website content.
 * Returns null on any failure — deterministic scraper signals remain the fallback.
 */
export async function extractSignalsWithLlm(
  analysis: WebsiteAnalysis,
  providerOverride?: LlmProvider
): Promise<LlmExtractedSignals | null> {
  // Skip if there is nothing meaningful to analyze
  if (
    !analysis.title &&
    !analysis.bodyTextSample &&
    analysis.h1Headings.length === 0
  ) {
    return null;
  }

  let provider;
  try {
    provider = providerOverride ?? getLlmProvider();
  } catch {
    return null;
  }

  const { system, user } = buildSignalExtractionPrompt(analysis);

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 300,
      temperature: 0,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[SignalExtractor] LLM call failed:", err);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Validate all 10 fields are present and boolean
    for (const field of REQUIRED_FIELDS) {
      if (typeof parsed[field] !== "boolean") {
        console.warn(`[SignalExtractor] Missing or non-boolean field: ${field}`);
        return null;
      }
    }
    return parsed as unknown as LlmExtractedSignals;
  } catch (parseErr) {
    console.warn("[SignalExtractor] JSON parse failed:", parseErr);
    return null;
  }
}
