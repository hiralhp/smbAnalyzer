// ─────────────────────────────────────────────────────────────────────────────
// Query Coverage Analysis
//
// Generates likely user queries from category + city + services, then checks
// how well the scraped website content covers each query.
//
// ANALYTICAL ASSET: results stored in report_query_coverage for benchmarking
// and future analytics across businesses and categories.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis, QueryCoverageRow, CanonicalCategory } from "@/lib/types";
import { CATEGORY_NOUNS } from "./category-templates";

function getCategoryNoun(canonicalCategory: CanonicalCategory): string {
  return CATEGORY_NOUNS[canonicalCategory] ?? "business";
}

// ── Query templates ───────────────────────────────────────────────────────────

interface QueryTemplate {
  query: string;
  queryType: string;
  /** Terms that need to appear somewhere in the page content */
  requiredTerms: string[];
  /** Terms that should appear in title or headings for "strong" coverage */
  prominentTerms: string[];
}

function buildQueryTemplates(
  canonicalCategory: CanonicalCategory,
  city: string,
  services: string[]
): QueryTemplate[] {
  const noun = getCategoryNoun(canonicalCategory);
  const templates: QueryTemplate[] = [];

  // Brand local queries (high intent)
  if (city) {
    templates.push({
      query: `best ${noun} in ${city}`,
      queryType: "brand_local",
      requiredTerms: [noun, city],
      prominentTerms: [city],
    });
    templates.push({
      query: `${noun} near ${city}`,
      queryType: "proximity_local",
      requiredTerms: [noun, city],
      prominentTerms: [city],
    });
    templates.push({
      query: `affordable ${noun} ${city}`,
      queryType: "price_local",
      requiredTerms: [city],
      prominentTerms: [],
    });
    templates.push({
      query: `${noun} reviews ${city}`,
      queryType: "reputation_local",
      requiredTerms: [city],
      prominentTerms: [],
    });
  }

  // Generic queries (no city)
  templates.push({
    query: `${noun} near me`,
    queryType: "proximity_generic",
    requiredTerms: [noun],
    prominentTerms: [],
  });

  // Service-specific queries
  for (const service of services.slice(0, 4)) {
    const sLower = service.toLowerCase();
    if (city) {
      templates.push({
        query: `${sLower} in ${city}`,
        queryType: "service_local",
        requiredTerms: [sLower, city],
        prominentTerms: [sLower],
      });
    }
    templates.push({
      query: `${sLower} near me`,
      queryType: "service_proximity",
      requiredTerms: [sLower],
      prominentTerms: [],
    });
  }

  return templates;
}

// ── Coverage checker ──────────────────────────────────────────────────────────

function checkCoverage(
  template: QueryTemplate,
  analysis: WebsiteAnalysis
): QueryCoverageRow {
  const titleText = (analysis.title ?? "").toLowerCase();
  const headingText = [
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const bodyText = (analysis.bodyTextSample ?? "").toLowerCase();
  const allText = `${titleText} ${headingText} ${bodyText}`;

  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  for (const term of template.requiredTerms) {
    if (allText.includes(term.toLowerCase())) {
      matchedTerms.push(term);
    } else {
      missingTerms.push(term);
    }
  }

  const titleMatch = template.prominentTerms.length > 0
    ? template.prominentTerms.some((t) => titleText.includes(t.toLowerCase()))
    : template.requiredTerms.some((t) => titleText.includes(t.toLowerCase()));

  const headingMatch = template.requiredTerms.some((t) =>
    headingText.includes(t.toLowerCase())
  );

  const bodyMatch = template.requiredTerms.every((t) =>
    bodyText.includes(t.toLowerCase())
  );

  const servicePageMatch = analysis.hasServicePages &&
    template.requiredTerms.some((t) => headingText.includes(t.toLowerCase()));

  // Coverage classification:
  // strong  — all terms matched AND at least one in title or heading
  // partial — all terms matched in body but not in title/heading, OR most terms matched
  // weak    — key terms missing
  let coverage: "strong" | "partial" | "weak";

  const allMatched = missingTerms.length === 0;
  const mostMatched = matchedTerms.length >= template.requiredTerms.length - 1
    && template.requiredTerms.length > 1;

  if (allMatched && (titleMatch || headingMatch)) {
    coverage = "strong";
  } else if (allMatched || mostMatched) {
    coverage = "partial";
  } else {
    coverage = "weak";
  }

  return {
    query: template.query,
    queryType: template.queryType,
    coverage,
    missingTerms,
    matchedTerms,
    titleMatch,
    headingMatch,
    bodyMatch,
    servicePageMatch,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate and evaluate query coverage for a website analysis.
 * Purely deterministic — no LLM.
 */
export function computeQueryCoverage(
  analysis: WebsiteAnalysis,
  canonicalCategory: CanonicalCategory,
  city: string,
  services: string[]
): QueryCoverageRow[] {
  // Still generate queries for no-URL reports using the effective city/category —
  // just coverage will all be "weak" since there's no content to match against.
  const templates = buildQueryTemplates(canonicalCategory, city, services);
  return templates.map((t) => checkCoverage(t, analysis));
}
