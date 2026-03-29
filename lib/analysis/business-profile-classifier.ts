// ─────────────────────────────────────────────────────────────────────────────
// Business Profile Classifier
//
// Produces a multi-dimensional BusinessProfile by:
//   1. Detecting sector (form input → keyword raw-score → null fallback)
//   2. Detecting offering_model, customer_actions, key_entities, attributes
//      — all derived from BusinessFeatures + WebsiteAnalysis
//
// No LLM. Pure deterministic inference.
// ─────────────────────────────────────────────────────────────────────────────

import type { BusinessProfile, BusinessModel, WebsiteAnalysis, BusinessFeatures } from "@/lib/types";
import {
  SECTOR_FORM_MAP,
  SECTOR_KEYWORDS,
  SECTOR_MIN_SCORE,
  SECTOR_MEDIUM_SCORE,
  SECTOR_HIGH_SCORE,
  FOOD_SUBTYPE_SIGNALS,
} from "./business-profile-templates";

// ── Raw keyword scorer ─────────────────────────────────────────────────────────
// title/H1 hit = 3 pts, H2 hit = 2 pts, body hit = 1 pt

function rawSectorScore(sector: string, analysis: WebsiteAnalysis): number {
  const keywords = SECTOR_KEYWORDS[sector] ?? [];
  const titleH1 = [analysis.title ?? "", ...(analysis.h1Headings ?? [])]
    .join(" ")
    .toLowerCase();
  const h2Text = (analysis.h2Headings ?? []).join(" ").toLowerCase();
  const bodyText = (analysis.bodyTextSample ?? "").toLowerCase();

  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (titleH1.includes(kwLower)) {
      score += 3;
    } else if (h2Text.includes(kwLower)) {
      score += 2;
    } else if (bodyText.includes(kwLower)) {
      score += 1;
    }
  }
  return score;
}

// ── Sector detection ──────────────────────────────────────────────────────────

function detectSector(
  formCategory: string | undefined,
  analysis: WebsiteAnalysis
): {
  sector: string | null;
  confidence: "high" | "medium" | "low";
  matched_rules: string[];
} {
  const matched_rules: string[] = [];

  // 1. Form-provided category → immediate high-confidence assignment
  if (formCategory && SECTOR_FORM_MAP[formCategory]) {
    const sector = SECTOR_FORM_MAP[formCategory];
    matched_rules.push(`form_category:${formCategory}`);
    return { sector, confidence: "high", matched_rules };
  }

  // 2. Keyword raw-score across all sectors
  const sectors = Object.keys(SECTOR_KEYWORDS);
  let bestSector: string | null = null;
  let bestScore = 0;

  for (const sector of sectors) {
    const score = rawSectorScore(sector, analysis);
    if (score > bestScore) {
      bestScore = score;
      bestSector = sector;
    }
  }

  if (bestSector !== null && bestScore >= SECTOR_MIN_SCORE) {
    matched_rules.push(`keyword_score:${bestSector}=${bestScore}`);
    const confidence: "high" | "medium" | "low" =
      bestScore >= SECTOR_HIGH_SCORE ? "high" :
      bestScore >= SECTOR_MEDIUM_SCORE ? "medium" :
      "low";
    return { sector: bestSector, confidence, matched_rules };
  }

  // 3. Fallback — no sector detected
  matched_rules.push("no_sector_match");
  return { sector: null, confidence: "low", matched_rules };
}

// ── Offering model detection ───────────────────────────────────────────────────

function detectOfferingModels(
  analysis: WebsiteAnalysis,
  features: BusinessFeatures
): string[] {
  const allText = [
    analysis.title ?? "",
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    analysis.bodyTextSample ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const models: string[] = [];

  if (features.hasMenuOrCatalog) {
    const hasDeliveryOrCart =
      allText.includes("delivery") ||
      allText.includes("takeout") ||
      allText.includes("add to cart");
    if (hasDeliveryOrCart && !analysis.hasHours) {
      models.push("ecommerce");
    } else {
      models.push("menu_based");
    }
  }

  if (features.hasBookingOrReservations && !features.hasMenuOrCatalog) {
    models.push("appointment_based");
  }

  if (
    features.hasQuoteIntent ||
    (features.hasServicePages && analysis.hasLocationMention)
  ) {
    models.push("service_area_business");
  }

  if (features.requiresCredentials && features.hasServicePages) {
    models.push("consultation_based");
  }

  if (analysis.hasHours || analysis.hasContactInfo || analysis.hasLocationMention) {
    models.push("physical_location");
  }

  if (
    allText.includes("rooms") ||
    allText.includes("suites") ||
    allText.includes("check-in") ||
    allText.includes("check in")
  ) {
    if (!models.includes("appointment_based")) {
      models.push("bookable_rooms");
    }
  }

  if (
    allText.includes("class schedule") ||
    (allText.includes("classes") && allText.includes("schedule"))
  ) {
    models.push("class_based");
  }

  return Array.from(new Set(models));
}

// ── Customer actions detection ─────────────────────────────────────────────────

function detectCustomerActions(
  features: BusinessFeatures,
  analysis: WebsiteAnalysis,
  offeringModels: string[]
): string[] {
  const actions: string[] = [];
  const allText = [
    analysis.title ?? "",
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    analysis.bodyTextSample ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Primary conversion from features
  if (features.primaryConversion !== "unknown") {
    actions.push(features.primaryConversion);
  }

  // Secondary from offering models
  if (offeringModels.includes("menu_based") && !actions.includes("visit")) {
    actions.push("visit");
  }
  if (
    (allText.includes("delivery") || allText.includes("takeout")) &&
    !actions.includes("order")
  ) {
    actions.push("order");
  }

  return Array.from(new Set(actions));
}

// ── Key entities detection ─────────────────────────────────────────────────────

function detectKeyEntities(
  analysis: WebsiteAnalysis,
  features: BusinessFeatures
): string[] {
  const entities: string[] = [];
  const allText = [
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    analysis.bodyTextSample ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (features.hasServicePages) entities.push("services");
  if (analysis.hasPricing) entities.push("pricing");
  if (analysis.hasTestimonials) entities.push("testimonials");
  if (analysis.hasFaq) entities.push("faq");
  if (analysis.hasHours) entities.push("hours");
  if (features.hasMenuOrCatalog) entities.push("menu_items");
  if (allText.includes("rooms") || allText.includes("suites")) {
    entities.push("rooms");
  }

  return entities;
}

// ── Attributes detection ───────────────────────────────────────────────────────

function detectAttributes(
  analysis: WebsiteAnalysis,
  features: BusinessFeatures
): string[] {
  const attributes: string[] = [];
  const allText = [
    analysis.title ?? "",
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    analysis.bodyTextSample ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (features.requiresCredentials || analysis.hasTrustSignals) {
    attributes.push("licensed");
  }
  if (
    allText.includes("emergency") ||
    allText.includes("24/7") ||
    allText.includes("24 hours")
  ) {
    attributes.push("emergency_service");
  }
  if (
    allText.includes("affordable") ||
    allText.includes("budget") ||
    allText.includes("low cost")
  ) {
    attributes.push("affordable");
  }
  if (
    allText.includes("luxury") ||
    allText.includes("premium") ||
    allText.includes("exclusive")
  ) {
    attributes.push("luxury");
  }
  if (allText.includes("family owned") || allText.includes("family-owned")) {
    attributes.push("family_owned");
  }
  if (
    allText.includes("multiple locations") ||
    (allText.includes("locations") && (allText.match(/locations/g) ?? []).length > 1)
  ) {
    attributes.push("multi_location");
  }

  return Array.from(new Set(attributes));
}

// ── Business model inference ──────────────────────────────────────────────────

function inferBusinessModel(
  features: BusinessFeatures,
  analysis: WebsiteAnalysis
): BusinessModel {
  const bodyText = (analysis.bodyTextSample ?? "").toLowerCase();

  // accommodation — rooms/suites/check-in signals take priority (before menu check)
  if (
    bodyText.includes("rooms") ||
    bodyText.includes("suites") ||
    bodyText.includes("check-in") ||
    bodyText.includes("check in")
  ) {
    return "accommodation";
  }

  // retail_product — e-commerce: has catalog/menu AND delivery AND no physical hours
  if (features.hasMenuOrCatalog && features.hasDelivery && !analysis.hasHours) {
    return "retail_product";
  }

  // venue_experience — has a menu/catalog but not pure e-commerce
  if (features.hasMenuOrCatalog) {
    return "venue_experience";
  }

  // professional_advisory — credentials required AND has service pages
  if (features.requiresCredentials && features.hasServicePages) {
    return "professional_advisory";
  }

  // appointment_based — booking signals AND has service pages
  if (features.hasBookingOrReservations && features.hasServicePages) {
    return "appointment_based";
  }

  // transactional_service — quote intent OR (service pages + location)
  if (
    features.hasQuoteIntent ||
    (features.hasServicePages && analysis.hasLocationMention)
  ) {
    return "transactional_service";
  }

  return "unknown";
}

// ── Food subtype detection ────────────────────────────────────────────────────

type FoodSubtype = "restaurant" | "cafe_coffee_shop" | "bakery" | "bar";

/**
 * Derives a canonical food subtype when sector is "food_and_beverage".
 *
 * Uses a scoring approach: count matched signals per subtype. Non-restaurant
 * subtypes (cafe, bakery, bar) must score HIGHER than restaurant to win,
 * preventing ambiguous signals (e.g. "cocktails" on a restaurant menu) from
 * triggering the wrong subtype.
 *
 * Returns null when no signals match at all (falls through to sector-level FAQ).
 */
function deriveFoodSubtype(
  analysis: WebsiteAnalysis,
  detectedTerms: string[]
): FoodSubtype | null {
  // Fast path: explicit detected terms from BusinessFeatures are unambiguous
  const coffeeTerms = new Set(["coffee shop", "cafe", "coffee"]);
  const bakeryTerms = new Set(["bakery"]);
  const barTerms = new Set(["bar"]);

  for (const term of detectedTerms) {
    if (coffeeTerms.has(term)) return "cafe_coffee_shop";
    if (bakeryTerms.has(term)) return "bakery";
    if (barTerms.has(term)) return "bar";
  }

  // Score page content against FOOD_SUBTYPE_SIGNALS
  const text = [
    analysis.title ?? "",
    analysis.metaDescription ?? "",
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    (analysis.bodyTextSample ?? "").slice(0, 1000),
  ]
    .join(" ")
    .toLowerCase();

  const subtypes: FoodSubtype[] = ["cafe_coffee_shop", "bakery", "bar", "restaurant"];
  const scores: Record<FoodSubtype, number> = {
    cafe_coffee_shop: 0,
    bakery: 0,
    bar: 0,
    restaurant: 0,
  };

  for (const subtype of subtypes) {
    const signals = FOOD_SUBTYPE_SIGNALS[subtype] ?? [];
    scores[subtype] = signals.filter((s) => text.includes(s.toLowerCase())).length;
  }

  const restaurantScore = scores.restaurant;

  // Find the highest-scoring non-restaurant subtype
  const specific: FoodSubtype[] = ["cafe_coffee_shop", "bakery", "bar"];
  const bestSpecific = specific.reduce<FoodSubtype>(
    (best, st) => (scores[st] > scores[best] ? st : best),
    "cafe_coffee_shop"
  );
  const bestSpecificScore = scores[bestSpecific];

  // Non-restaurant must have >= 2 signals AND beat restaurant score to override
  if (bestSpecificScore >= 2 && bestSpecificScore > restaurantScore) {
    return bestSpecific;
  }

  // Restaurant wins when it has any signal (most common food_and_beverage type)
  if (restaurantScore >= 1) {
    return "restaurant";
  }

  return null; // no signal match → sector-level FAQ fallback
}

// ── Public classifier ─────────────────────────────────────────────────────────

/**
 * Classify a business into a multi-dimensional BusinessProfile.
 * Uses form category + keyword scoring for sector, then derives all other
 * dimensions from BusinessFeatures and WebsiteAnalysis.
 */
export function classifyBusinessProfile(
  formCategory: string | undefined,
  analysis: WebsiteAnalysis,
  features: BusinessFeatures
): BusinessProfile {
  const { sector, confidence, matched_rules } = detectSector(formCategory, analysis);

  const offering_model = detectOfferingModels(analysis, features);
  const customer_actions = detectCustomerActions(features, analysis, offering_model);
  const key_entities = detectKeyEntities(analysis, features);
  const attributes = detectAttributes(analysis, features);

  // Sector-aware subtype allowlists — prevents detectedBusinessTerms from assigning
  // cross-sector subtypes. Example: a hotel page mentioning a "gym" must not get
  // subtype="gym". For sectors not in this map, subtype is omitted entirely.
  const SECTOR_SUBTYPE_ALLOWLIST: Partial<Record<string, readonly string[]>> = {
    health_wellness:  ["med spa", "chiropractor", "dentist"],
    fitness:          ["yoga studio", "gym"],
    home_services:    ["plumber", "electrician", "HVAC", "roofer"],
    // food_and_beverage handled by deriveFoodSubtype below
    // hospitality, retail_store, professional_services → null (too diverse for reliable subtype)
  };

  const subtype =
    sector === "food_and_beverage"
      ? deriveFoodSubtype(analysis, features.detectedBusinessTerms)
      : (() => {
          if (!sector) return null;
          const allowed = SECTOR_SUBTYPE_ALLOWLIST[sector];
          if (!allowed) return null; // sector has no stable subtype mapping — omit
          return features.detectedBusinessTerms.find((t) => allowed.includes(t)) ?? null;
        })();

  const business_model = inferBusinessModel(features, analysis);

  return {
    sector,
    subtype,
    business_model,
    offering_model,
    customer_actions,
    key_entities,
    attributes,
    confidence,
    matched_rules,
    // Placeholder — overridden immediately by detectWebsitePattern() in the pipeline
    website_pattern: "generic_unknown",
  };
}
