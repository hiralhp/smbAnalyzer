// ─────────────────────────────────────────────────────────────────────────────
// Location Extractor
//
// Extracts an effective city/location from all available sources.
// Never returns empty if a location is detectable anywhere in the data.
//
// Sources (priority order):
//   1. formInput.city (user provided) — highest confidence
//   2. Title tag ("City, ST" pattern or "in City" / "serving City")
//   3. H1 headings
//   4. H2 headings
//   5. Meta description
//   6. Body text (first 500 chars)
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis } from "@/lib/types";

export interface ExtractedLocation {
  city: string;
  source: "user_input" | "title" | "heading" | "meta" | "body";
  confidence: "high" | "medium" | "low";
}

// Patterns in priority order
const CITY_STATE_PATTERN = /\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})\b/;
const SERVING_PATTERN = /\bserving\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,|·•&]|$)/i;
const LOCATED_PATTERN = /\blocated\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,|·•&]|$)/i;
const BASED_IN_PATTERN = /\bbased\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,|·•&]|$)/i;

function extractFromText(text: string): string | null {
  // "City, ST" pattern — most reliable
  const cityState = CITY_STATE_PATTERN.exec(text);
  if (cityState) return `${cityState[1].trim()}, ${cityState[2]}`;

  // "serving City" pattern
  const serving = SERVING_PATTERN.exec(text);
  if (serving) return serving[1].trim();

  // "located in City" pattern
  const located = LOCATED_PATTERN.exec(text);
  if (located) return located[1].trim();

  // "based in City" pattern
  const basedIn = BASED_IN_PATTERN.exec(text);
  if (basedIn) return basedIn[1].trim();

  return null;
}

/**
 * Extract the best available location from all sources.
 * Returns null if nothing is detectable.
 */
export function extractLocation(
  formCity: string | undefined,
  analysis: WebsiteAnalysis
): ExtractedLocation | null {
  // 1. User-provided city — trust it
  if (formCity?.trim()) {
    return {
      city: formCity.trim(),
      source: "user_input",
      confidence: "high",
    };
  }

  if (analysis.fetchError) return null;

  // 2. Title tag
  if (analysis.title) {
    const found = extractFromText(analysis.title);
    if (found) {
      return { city: found, source: "title", confidence: "high" };
    }
  }

  // 3. H1 headings
  for (const h1 of analysis.h1Headings ?? []) {
    const found = extractFromText(h1);
    if (found) {
      return { city: found, source: "heading", confidence: "high" };
    }
  }

  // 4. H2 headings
  for (const h2 of analysis.h2Headings ?? []) {
    const found = extractFromText(h2);
    if (found) {
      return { city: found, source: "heading", confidence: "medium" };
    }
  }

  // 5. Meta description
  if (analysis.metaDescription) {
    const found = extractFromText(analysis.metaDescription);
    if (found) {
      return { city: found, source: "meta", confidence: "medium" };
    }
  }

  // 6. Body text (first 500 chars only — less reliable deeper in body)
  const bodySlice = (analysis.bodyTextSample ?? "").slice(0, 500);
  if (bodySlice) {
    const found = extractFromText(bodySlice);
    if (found) {
      return { city: found, source: "body", confidence: "low" };
    }
  }

  return null;
}
