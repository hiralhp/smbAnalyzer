// ─────────────────────────────────────────────────────────────────────────────
// Location Extractor
//
// Extracts an effective city/location from all available sources.
// Never returns empty if a location is detectable anywhere in the data.
//
// Sources (priority order):
//   1. formInput.city (user provided) — highest confidence
//   2. schema.org PostalAddress (JSON-LD) — high confidence
//   3. Title tag ("City, ST" pattern or "in City" / "serving City")
//   4. H1 headings
//   5. H2 headings
//   6. Meta description
//   7. Body text (first 500 chars)
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis } from "@/lib/types";

export interface ExtractedLocation {
  city: string;
  source: "user_input" | "schema" | "title" | "heading" | "meta" | "body";
  confidence: "high" | "medium" | "low";
}

// ── State name → abbreviation map ─────────────────────────────────────────────
// Used to normalize schema.org addressRegion (may be full name or abbreviation).

const STATE_NAMES: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
  "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
};

function normalizeState(raw: string): string {
  if (raw.length === 2) return raw.toUpperCase(); // already abbreviated
  return STATE_NAMES[raw] ?? raw; // normalize full name or pass through
}

// ── Text extraction patterns ──────────────────────────────────────────────────

const CITY_STATE_PATTERN = /\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})\b/;
// "Smyrna TN" — city + 2-letter state abbreviation without comma
const CITY_STATE_NO_COMMA = /\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?)\s+([A-Z]{2})\b/;
const SERVING_PATTERN = /\bserving\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,|·•&]|$)/i;
const LOCATED_PATTERN = /\blocated\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,|·•&]|$)/i;
const BASED_IN_PATTERN = /\bbased\s+in\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,|·•&]|$)/i;

function extractFromText(text: string): string | null {
  // "City, ST" pattern — most reliable
  const cityState = CITY_STATE_PATTERN.exec(text);
  if (cityState) return `${cityState[1].trim()}, ${cityState[2]}`;

  // "City ST" pattern — no comma (common in title tags and H1s)
  const cityStateNoComma = CITY_STATE_NO_COMMA.exec(text);
  if (cityStateNoComma) return `${cityStateNoComma[1].trim()}, ${cityStateNoComma[2]}`;

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

  // 2. schema.org PostalAddress (JSON-LD or microdata) — highest-confidence structured source
  const addr = analysis.schemaOrgAddress;
  if (addr?.city) {
    const stateAbbr = addr.state ? normalizeState(addr.state) : undefined;
    const city = stateAbbr ? `${addr.city}, ${stateAbbr}` : addr.city;
    return { city, source: "schema", confidence: "high" };
  }

  // 2b. <meta name="city"> — common on hotel/local sites
  if (analysis.metaCity) {
    const rawState = analysis.metaState ?? "";
    const stateAbbr = rawState ? normalizeState(rawState) : undefined;
    const city = stateAbbr ? `${analysis.metaCity}, ${stateAbbr}` : analysis.metaCity;
    return { city, source: "schema", confidence: "high" };
  }

  // 3. Title tag
  if (analysis.title) {
    const found = extractFromText(analysis.title);
    if (found) {
      return { city: found, source: "title", confidence: "high" };
    }
  }

  // 4. H1 headings
  for (const h1 of analysis.h1Headings ?? []) {
    const found = extractFromText(h1);
    if (found) {
      return { city: found, source: "heading", confidence: "high" };
    }
  }

  // 5. H2 headings
  for (const h2 of analysis.h2Headings ?? []) {
    const found = extractFromText(h2);
    if (found) {
      return { city: found, source: "heading", confidence: "medium" };
    }
  }

  // 6. Meta description
  if (analysis.metaDescription) {
    const found = extractFromText(analysis.metaDescription);
    if (found) {
      return { city: found, source: "meta", confidence: "medium" };
    }
  }

  // 7. Body text (first 500 chars only — less reliable deeper in body)
  const bodySlice = (analysis.bodyTextSample ?? "").slice(0, 500);
  if (bodySlice) {
    const found = extractFromText(bodySlice);
    if (found) {
      return { city: found, source: "body", confidence: "low" };
    }
  }

  return null;
}
