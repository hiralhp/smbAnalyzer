// ─────────────────────────────────────────────────────────────────────────────
// Business Name Extractor
//
// Priority-ordered extraction of the business name from a WebsiteAnalysis.
// Validates that the chosen name is a literal brand/property identity,
// not a generic SEO phrase like "Downtown Hotels Nashville".
//
// Priority:
//   1. schema.org name (JSON-LD or microdata) — explicitly structured
//   2. og:site_name — set by site owner
//   3. cleanTitle(title) — strips marketing modifiers; prefers brand segment
//   4. Shortest non-generic H1 under 80 chars
//   5. Domain base name as capitalized fallback
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis } from "@/lib/types";

// ── Generic SEO phrase detection ──────────────────────────────────────────────
// These patterns suggest a keyword cluster, not a brand/property identity.

const GENERIC_SEO_PATTERNS: RegExp[] = [
  // "Downtown Hotels Nashville", "Best Hotels in Smyrna"
  /^(best|top|cheap|affordable|discount|luxury|budget|premier|quality)\s+\w/i,
  // "Hotels Nashville", "Hotels in Nashville", "Hotel Near Broadway"
  /^(hotel|hotels|restaurant|restaurants|cafe|salon|gym|plumber|dentist)\s+(in|near|of|at)\s/i,
  // Leading category word with city: "Nashville Hotels", "Denver Restaurants"
  /^[A-Z][a-z]{3,}\s+(hotels?|restaurants?|cafes?|gyms?|salons?)\b/i,
  // "Downtown X Hotel/Restaurant/…" — geographic descriptor as lead
  /^(downtown|uptown|midtown|northside|southside|eastside|westside)\s+\w+\s+(hotel|inn|resort|restaurant|bar|cafe)\b/i,
  // Pure keyword cluster: three or more common nouns without brand capitalisation
  /^(the\s+)?(best|top|great|premier|affordable)\s+(local\s+)?\w+\s+\w+(s)?\s+in\b/i,
];

/**
 * Returns true if the string looks like a generic SEO keyphrase
 * rather than a literal business/property name.
 */
function isGenericSeoPhrase(name: string): boolean {
  const trimmed = name.trim();
  return GENERIC_SEO_PATTERNS.some((p) => p.test(trimmed));
}

// ── Title tag cleaning ────────────────────────────────────────────────────────

const PAGE_TYPE_PREFIXES: RegExp[] = [
  /^menu\s*[|–\-]\s*/i,
  /^home\s*[|–\-]\s*/i,
  /^welcome to\s+/i,
  /^official site of\s+/i,
];

// Matches trailing " | City, ST", ", City, ST", " – City, ST", " - City, ST"
const CITY_STATE_SUFFIXES: RegExp[] = [
  /\s*[|–\-]\s*[A-Z][a-z]{2,},?\s*[A-Z]{2}\s*$/,
  /,\s*[A-Z][a-z]{2,},?\s*[A-Z]{2}\s*$/,
];

/**
 * Clean a raw title tag and return the best non-generic brand segment.
 *
 * When a pipe separator is present, we prefer the segment that:
 *   a) is not a generic SEO phrase, AND
 *   b) is shorter (brand names are usually concise)
 * rather than blindly picking the shortest.
 */
function cleanTitle(title: string): string | undefined {
  let cleaned = title.trim();

  // Strip leading page-type prefixes
  for (const prefix of PAGE_TYPE_PREFIXES) {
    cleaned = cleaned.replace(prefix, "");
  }

  // Strip trailing city/state suffixes
  for (const suffix of CITY_STATE_SUFFIXES) {
    cleaned = cleaned.replace(suffix, "");
  }

  // Pipe separator: pick the best (non-generic, then shortest) segment
  if (cleaned.includes(" | ")) {
    const parts = cleaned.split(" | ").map((s) => s.trim()).filter((s) => s.length > 1);
    if (parts.length > 0) {
      // Prefer the first non-generic segment; fall back to shortest overall
      const nonGeneric = parts.filter((s) => !isGenericSeoPhrase(s));
      if (nonGeneric.length > 0) {
        cleaned = nonGeneric.reduce((a, b) => (a.length <= b.length ? a : b));
      } else {
        // All segments look generic — use shortest as last resort
        cleaned = parts.reduce((a, b) => (a.length <= b.length ? a : b));
      }
    }
  }

  // Em-dash / regular-dash separator: take the first segment (brand usually leads)
  // Unlike pipe, the brand name typically comes FIRST ("La Quinta Nashville - Hotel")
  if (cleaned.includes(" – ") || cleaned.includes(" - ")) {
    const parts = cleaned.split(/\s+[–-]\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
    if (parts.length > 0) {
      const nonGeneric = parts.filter((s) => !isGenericSeoPhrase(s));
      cleaned = nonGeneric.length > 0 ? nonGeneric[0] : parts[0];
    }
  }

  cleaned = cleaned.trim();
  if (!cleaned || cleaned.length < 2) return undefined;
  if (isGenericSeoPhrase(cleaned)) return undefined; // final guard
  return cleaned;
}

/**
 * Extract the most reliable business name from a scraped WebsiteAnalysis.
 * Returns undefined if no usable name can be found.
 */
export function extractBusinessName(analysis: WebsiteAnalysis): string | undefined {
  // 1. schema.org name (JSON-LD or microdata) — most structured, explicitly set
  if (analysis.schemaOrgName && analysis.schemaOrgName.length > 1 && !isGenericSeoPhrase(analysis.schemaOrgName)) {
    return analysis.schemaOrgName;
  }

  // 2. og:site_name — explicitly set by site owner
  if (analysis.ogSiteName && analysis.ogSiteName.length > 1 && !isGenericSeoPhrase(analysis.ogSiteName)) {
    return analysis.ogSiteName;
  }

  // 3. Cleaned <title> — strips marketing copy; prefers non-generic brand segment
  if (analysis.title) {
    const cleaned = cleanTitle(analysis.title);
    if (cleaned) return cleaned;
  }

  // 4. H1 headings — use the first one that isn't generic and is under 80 chars
  for (const h1 of analysis.h1Headings ?? []) {
    if (h1.length > 1 && h1.length < 80 && !isGenericSeoPhrase(h1)) {
      // Strip dash-separated city/location suffixes from H1 too
      const parts = h1.split(/\s+[–-]\s+/).map((s) => s.trim()).filter(Boolean);
      const candidate = parts.length > 1 && !isGenericSeoPhrase(parts[0]) ? parts[0] : h1;
      if (!isGenericSeoPhrase(candidate) && candidate.length > 1) return candidate;
    }
  }

  // 5. Domain base as capitalized fallback
  try {
    const hostname = new URL(analysis.url).hostname.replace(/^www\./, "");
    const base = hostname.split(".")[0];
    if (base && base.length > 1) {
      return base.charAt(0).toUpperCase() + base.slice(1);
    }
  } catch { /* ignore malformed URL */ }

  return undefined;
}
