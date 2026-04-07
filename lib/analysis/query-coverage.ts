// ─────────────────────────────────────────────────────────────────────────────
// Query Coverage Analysis
//
// Generates likely user queries from profile + city + services, then checks
// how well the scraped website content covers each query.
//
// ANALYTICAL ASSET: results stored in report_query_coverage for benchmarking
// and future analytics across businesses and categories.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WebsiteAnalysis,
  QueryCoverageRow,
  BusinessProfile,
  BusinessFeatures,
} from "@/lib/types";
import { PATTERN_NOUNS, PATTERN_QUERY_INTENTS } from "./website-pattern-templates";
import { SUBTYPE_NOUNS } from "./business-profile-templates";

// Sector-specific nouns produce more precise queries (e.g. "restaurant near me"
// instead of the generic "business near me" for food_and_beverage).
// Subtype noun (more specific) is checked first.
const SECTOR_NOUNS: Partial<Record<string, string>> = {
  food_and_beverage:    "restaurant",
  retail_store:         "shop",
  hospitality:          "hotel",
  health_wellness:      "wellness center",
  fitness:              "gym",
  home_services:        "contractor",
  professional_services:"firm",
};

// ── Sector query intent definitions ──────────────────────────────────────────
// Each intent has a display string AND explicit required terms for coverage scoring.
// requiredTerms: terms that must appear somewhere in the page for strong/partial coverage.
// termMatchMode "any" = ANY term satisfies the check (synonym family).
// termMatchMode "all" (default) = ALL terms must match.

interface SectorIntent {
  intent: string;           // appended to noun: "hotel room rates"
  requiredTerms: string[];  // coverage evidence
  termMatchMode?: "all" | "any";
}

const SECTOR_QUERY_INTENTS: Partial<Record<string, SectorIntent[]>> = {
  hospitality: [
    { intent: "room rates",           requiredTerms: ["rate", "price", "per night", "nightly"],    termMatchMode: "any" },
    { intent: "amenities",            requiredTerms: ["amenities", "pool", "wifi", "fitness", "gym", "breakfast"], termMatchMode: "any" },
    { intent: "check-in time",        requiredTerms: ["check-in", "check in", "check-out", "checkout"],            termMatchMode: "any" },
    { intent: "parking",              requiredTerms: ["parking"],                                   termMatchMode: "any" },
    { intent: "pet policy",           requiredTerms: ["pet", "dog", "cat"],                         termMatchMode: "any" },
    { intent: "cancellation policy",  requiredTerms: ["cancellation", "cancel", "refund", "policy"], termMatchMode: "any" },
  ],
  food_and_beverage: [
    { intent: "menu",         requiredTerms: ["menu"],                                            termMatchMode: "any" },
    { intent: "hours",        requiredTerms: ["hours", "open", "monday", "tuesday"],              termMatchMode: "any" },
    { intent: "reservations", requiredTerms: ["reservation", "reserve", "book a table", "opentable"], termMatchMode: "any" },
    { intent: "delivery",     requiredTerms: ["delivery", "takeout", "take-out", "order online"], termMatchMode: "any" },
  ],
  home_services: [
    { intent: "free estimate",       requiredTerms: ["estimate", "quote", "free"],       termMatchMode: "any" },
    { intent: "service area",        requiredTerms: ["service area", "serving", "area"], termMatchMode: "any" },
    { intent: "licensed and insured",requiredTerms: ["licensed", "insured"],              termMatchMode: "any" },
    { intent: "emergency service",   requiredTerms: ["emergency", "24/7", "urgent"],     termMatchMode: "any" },
  ],
  health_wellness: [
    { intent: "accepts insurance",    requiredTerms: ["insurance", "accept"],     termMatchMode: "any" },
    { intent: "new patients",         requiredTerms: ["patient", "new patient", "accepting"], termMatchMode: "any" },
    { intent: "book appointment",     requiredTerms: ["appointment", "book", "schedule"], termMatchMode: "any" },
    { intent: "services offered",     requiredTerms: ["service", "treatment"],   termMatchMode: "any" },
  ],
  fitness: [
    { intent: "membership pricing",   requiredTerms: ["membership", "price", "rate", "monthly"], termMatchMode: "any" },
    { intent: "class schedule",       requiredTerms: ["class", "schedule", "timetable"],         termMatchMode: "any" },
    { intent: "free trial",           requiredTerms: ["trial", "free class", "first class"],     termMatchMode: "any" },
    { intent: "personal training",    requiredTerms: ["personal training", "trainer"],           termMatchMode: "any" },
  ],
  professional_services: [
    { intent: "free consultation", requiredTerms: ["consultation", "free", "consult"], termMatchMode: "any" },
    { intent: "fees",              requiredTerms: ["fee", "rate", "charge", "cost"],   termMatchMode: "any" },
    { intent: "practice areas",    requiredTerms: ["practice", "service", "area"],    termMatchMode: "any" },
    { intent: "credentials",       requiredTerms: ["licensed", "certified", "accredited", "years"], termMatchMode: "any" },
  ],
  retail_store: [
    { intent: "store hours",    requiredTerms: ["hours", "open"],                  termMatchMode: "any" },
    { intent: "return policy",  requiredTerms: ["return", "refund", "policy"],     termMatchMode: "any" },
    { intent: "online shopping",requiredTerms: ["online", "shop", "order", "cart"],termMatchMode: "any" },
    { intent: "gift cards",     requiredTerms: ["gift card", "gift certificate"],  termMatchMode: "any" },
  ],
};

function getQueryNoun(profile: BusinessProfile, _features: BusinessFeatures): string {
  // Priority: subtype noun (most specific) → sector noun → pattern noun → generic
  const subtypeNoun = profile.subtype ? SUBTYPE_NOUNS[profile.subtype] : undefined;
  return subtypeNoun ?? SECTOR_NOUNS[profile.sector ?? ""] ?? PATTERN_NOUNS[profile.website_pattern] ?? "business";
}

function getSectorIntents(profile: BusinessProfile): SectorIntent[] | null {
  return SECTOR_QUERY_INTENTS[profile.sector ?? ""] ?? null;
}

// ── Query templates ───────────────────────────────────────────────────────────

interface QueryTemplate {
  query: string;
  queryType: string;
  /** Terms that need to appear somewhere in the page content */
  requiredTerms: string[];
  /** Terms that should appear in title or headings for "strong" coverage */
  prominentTerms: string[];
  /**
   * "all" (default): ALL requiredTerms must match for allMatched.
   * "any": ANY requiredTerm match satisfies the requirement (synonym matching).
   */
  termMatchMode?: "all" | "any";
}

function buildQueryTemplates(
  profile: BusinessProfile,
  features: BusinessFeatures,
  city: string,
  services: string[]
): QueryTemplate[] {
  const noun = getQueryNoun(profile, features);
  const templates: QueryTemplate[] = [];

  const hasLocalIntent = ["local_physical_business", "appointment_service"].includes(
    profile.website_pattern
  );

  // Brand local queries (high intent) — only for patterns with a location component
  if (city && hasLocalIntent) {
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

  // Generic proximity query — only for patterns with a location component
  if (hasLocalIntent) {
    templates.push({
      query: `${noun} near me`,
      queryType: "proximity_generic",
      requiredTerms: [noun],
      prominentTerms: [],
    });
  }

  // Service-specific queries
  for (const service of services.slice(0, 4)) {
    const sLower = service.toLowerCase();
    if (city && hasLocalIntent) {
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

  // Sector-specific intents with explicit required terms — sector takes priority
  const sectorIntents = getSectorIntents(profile);
  if (sectorIntents) {
    for (const si of sectorIntents) {
      templates.push({
        query: `${noun} ${si.intent}`,
        queryType: `intent_${profile.sector ?? profile.website_pattern}`,
        requiredTerms: si.requiredTerms,
        prominentTerms: [],
        termMatchMode: si.termMatchMode,
      });
    }
  } else {
    // Fallback to generic pattern intents (string array) for sectors without specific intents
    const patternIntents = PATTERN_QUERY_INTENTS[profile.website_pattern] ?? [];
    for (const intent of patternIntents) {
      templates.push({
        query: `${noun} ${intent}`,
        queryType: `pattern_${profile.website_pattern}`,
        requiredTerms: [noun],
        prominentTerms: [],
      });
    }
  }

  return templates;
}

// ── Reputation modifier detection ────────────────────────────────────────────
// Queries containing superlatives like "best" or "top" require off-site authority
// signals (reviews, awards, press) that on-site content cannot validate.

const REPUTATION_MODIFIERS_RE = /\b(best|top|leading|highly[\s-]rated|award[\s-]winning|most\s+trusted)\b/i;

function isReputationModifierQuery(query: string): boolean {
  return REPUTATION_MODIFIERS_RE.test(query);
}

function hasAuthoritySignals(analysis: WebsiteAnalysis): boolean {
  return analysis.hasTestimonials || analysis.hasTrustSignals;
}

// ── Evidence gates — downgrade Strong → Partial when key signal is absent ────
// Maps queryType → the WebsiteAnalysis signal that must be present for Strong.
// If the signal is absent, coverage is capped at Partial and evidenceNote is set.

const EVIDENCE_GATES: Partial<Record<string, { signal: keyof WebsiteAnalysis; note: string }>> = {
  brand_local:       { signal: "hasLocationMention", note: "Location signal absent — add your city name to headings" },
  proximity_local:   { signal: "hasLocationMention", note: "Location signal absent — add your city name to headings" },
  service_local:     { signal: "hasServicePages",    note: "No dedicated service pages detected" },
  service_proximity: { signal: "hasServicePages",    note: "No dedicated service pages detected" },
  reputation_local:  { signal: "hasTestimonials",    note: "No review or testimonial content found" },
  price_local:       { signal: "hasPricing",         note: "No pricing content found" },
};

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

  const titleMatch =
    template.prominentTerms.length > 0
      ? template.prominentTerms.some((t) => titleText.includes(t.toLowerCase()))
      : template.requiredTerms.some((t) => titleText.includes(t.toLowerCase()));

  const headingMatch = template.requiredTerms.some((t) =>
    headingText.includes(t.toLowerCase())
  );

  const bodyMatch = template.requiredTerms.every((t) =>
    bodyText.includes(t.toLowerCase())
  );

  const servicePageMatch =
    analysis.hasServicePages &&
    template.requiredTerms.some((t) => headingText.includes(t.toLowerCase()));

  // Coverage classification:
  // strong  — required terms satisfied AND at least one in title or heading
  // partial — required terms satisfied in body but not prominently, OR most matched
  // weak    — key terms missing
  //
  // For termMatchMode "any": satisfied when ANY required term matches (synonym families).
  // For termMatchMode "all" (default): ALL required terms must match.
  const matchMode = template.termMatchMode ?? "all";
  const allMatched =
    matchMode === "any" ? matchedTerms.length > 0 : missingTerms.length === 0;
  const mostMatched =
    matchMode === "all" &&
    matchedTerms.length >= template.requiredTerms.length - 1 &&
    template.requiredTerms.length > 1;

  // For "any" mode: the remaining unmatched terms are synonym alternatives, not
  // genuine gaps — the intent is already satisfied by whichever term matched.
  // Clear missingTerms so the UI doesn't show "Missing: pool, gym, breakfast"
  // when "wifi" already satisfied the amenities intent.
  const effectiveMissingTerms =
    matchMode === "any" && allMatched ? [] : missingTerms;

  let coverage: "strong" | "partial" | "weak" | "aspirational";
  if (allMatched && (titleMatch || headingMatch)) {
    coverage = "strong";
  } else if (allMatched || mostMatched) {
    coverage = "partial";
  } else {
    coverage = "weak";
  }

  // Evidence gate: downgrade Strong → Partial when a required signal is absent
  let evidenceNote: string | undefined;
  if (coverage === "strong") {
    const gate = EVIDENCE_GATES[template.queryType ?? ""];
    if (gate && !analysis[gate.signal]) {
      coverage = "partial";
      evidenceNote = gate.note;
    }
  }

  // Reputation gate — fires after evidence gates; has final say.
  // On-site content cannot validate "best X" queries — those require off-site authority.
  if (isReputationModifierQuery(template.query)) {
    if (!hasAuthoritySignals(analysis)) {
      coverage = "aspirational";
      evidenceNote =
        "Broad recommendation queries require on-site reviews, testimonials, or trust credentials. Competitors with stronger authority signals are more likely to appear here.";
    } else if (coverage === "strong") {
      coverage = "partial";
      evidenceNote =
        "Authority signals detected, but market-level recommendation confidence also requires off-site validation (reviews, awards, press).";
    }
  }

  return {
    query: template.query,
    queryType: template.queryType,
    coverage,
    missingTerms: effectiveMissingTerms,
    matchedTerms,
    titleMatch,
    headingMatch,
    bodyMatch,
    servicePageMatch,
    evidenceNote,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate and evaluate query coverage for a website analysis.
 * Purely deterministic — no LLM.
 *
 * Query noun priority: SECTOR_NOUNS[sector] → detectedBusinessTerms[0] → "business"
 */
export function computeQueryCoverage(
  analysis: WebsiteAnalysis,
  profile: BusinessProfile,
  features: BusinessFeatures,
  city: string,
  services: string[]
): QueryCoverageRow[] {
  const templates = buildQueryTemplates(profile, features, city, services);
  return templates.map((t) => checkCoverage(t, analysis));
}
