// ─────────────────────────────────────────────────────────────────────────────
// Business Features Inference
//
// Infers a normalized BusinessFeatures object from a WebsiteAnalysis.
// This is the feature-led layer that sits between raw extraction and report
// generation. Downstream logic (recommendations, FAQ, queries) uses features
// as the primary guardrail — NOT category templates.
//
// Deterministic only. No LLM calls.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  WebsiteAnalysis,
  BusinessFeatures,
  PrimaryConversion,
  TrustMode,
} from "@/lib/types";

// ── Signal lexicons ───────────────────────────────────────────────────────────

const MENU_SIGNALS = [
  "menu", "our menu", "view menu", "full menu", "daily menu",
  "order online", "order now", "order here", "place an order",
  "takeout", "take-out", "take out", "to go",
  "delivery", "delivers to", "doordash", "ubereats", "grubhub",
  "dish", "dishes", "item", "items", "specials", "today's special",
  "breakfast", "lunch", "dinner", "brunch", "entree", "appetizer",
  "coffee", "espresso", "latte", "cappuccino", "americano", "pour over",
  "pastry", "pastries", "bakery", "baked",
  "catalog", "catalogue", "browse our", "shop our", "our products",
  "collection", "product line",
];

const BOOKING_SIGNALS = [
  "book now", "book a", "booking", "book online", "book an appointment",
  "make a reservation", "reserve a table", "reserve your", "reservations",
  "schedule an appointment", "schedule a visit", "schedule online",
  "appointment", "appointments",
  "availability", "check availability", "available slots",
  "call to book", "call to schedule", "call for an appointment",
  "opentable", "resy", "yelp reservations",
];

// Specific quote/estimate language — NOT just any pricing mention
const QUOTE_SIGNALS = [
  "free estimate", "free estimates", "free quote",
  "get a quote", "request a quote", "get an estimate", "request an estimate",
  "no obligation estimate", "no-obligation",
  "contact us for a quote", "call for a quote",
  "price on request", "custom quote",
];

// License/insurance signals — these mean the business is in a regulated space
const CREDENTIAL_SIGNALS = [
  "licensed", "fully licensed", "state licensed",
  "insured", "fully insured",
  "bonded", "licensed and insured", "licensed & insured", "licensed, bonded",
  "certified contractor", "certified technician", "certified professional",
  "accredited", "state-certified",
  "lic#", "lic.", "license number", "contractor license",
  "mbe certified", "wbe certified", "dbe certified",
];

// Delivery/online ordering
const DELIVERY_SIGNALS = [
  "delivery", "delivers", "online ordering", "order online", "order ahead",
  "takeout", "take-out", "take out", "curbside pickup", "curbside",
  "doordash", "ubereats", "grubhub", "postmates", "caviar",
];

// Specific business terms for query generation, ordered from most → least specific
const DETECTED_TERM_PATTERNS: Array<{ term: string; signals: string[] }> = [
  // Coffee / cafe
  { term: "coffee shop", signals: ["coffee shop", "coffeehouse", "coffee house"] },
  { term: "cafe", signals: ["café", "cafe"] },
  { term: "coffee", signals: ["espresso", "latte", "cappuccino", "cold brew", "pour over", "specialty coffee"] },
  // Food service
  { term: "bakery", signals: ["bakery", "patisserie", "pastry shop", "bread"] },
  { term: "tea", signals: ["tea house", "teahouse", "boba", "bubble tea"] },
  { term: "bar", signals: ["cocktail bar", "wine bar", "craft beer", "brewery", "taproom"] },
  { term: "pizza", signals: ["pizza", "pizzeria"] },
  { term: "sushi", signals: ["sushi", "sashimi", "ramen"] },
  // Healthcare
  { term: "dentist", signals: ["dentist", "dental", "teeth", "tooth"] },
  { term: "med spa", signals: ["botox", "filler", "laser treatment", "med spa", "medspa", "aesthetic"] },
  { term: "chiropractor", signals: ["chiropractic", "chiropractor", "spinal", "adjustment"] },
  // Home services
  { term: "plumber", signals: ["plumber", "plumbing", "drain", "pipe repair"] },
  { term: "electrician", signals: ["electrician", "electrical", "wiring", "panel"] },
  { term: "HVAC", signals: ["hvac", "air conditioning", "furnace", "heat pump", "ac repair"] },
  { term: "roofer", signals: ["roofing", "roofer", "roof replacement", "roof repair"] },
  // Beauty
  { term: "hair salon", signals: ["hair salon", "haircut", "balayage", "blowout", "highlights"] },
  { term: "nail salon", signals: ["nail salon", "manicure", "pedicure", "gel nails"] },
  // Fitness
  { term: "yoga studio", signals: ["yoga", "vinyasa", "hot yoga", "meditation"] },
  { term: "gym", signals: ["gym", "fitness center", "weightlifting", "crossfit"] },
];

// ── Feature inference helpers ─────────────────────────────────────────────────

function buildFullText(analysis: WebsiteAnalysis): string {
  return [
    analysis.title ?? "",
    analysis.metaDescription ?? "",
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
    (analysis.bodyTextSample ?? "").slice(0, 1500),
  ]
    .join(" ")
    .toLowerCase();
}

function containsAny(text: string, signals: string[]): { matched: boolean; signal: string } {
  for (const s of signals) {
    if (text.includes(s.toLowerCase())) return { matched: true, signal: s };
  }
  return { matched: false, signal: "" };
}

function detectBusinessTerms(text: string): string[] {
  const found: string[] = [];
  for (const { term, signals } of DETECTED_TERM_PATTERNS) {
    if (signals.some((s) => text.includes(s.toLowerCase()))) {
      found.push(term);
      if (found.length >= 3) break; // cap at 3 to avoid noise
    }
  }
  return found;
}

function inferPrimaryConversion(
  features: Omit<BusinessFeatures, "primaryConversion" | "trustMode" | "featureEvidence">
): PrimaryConversion {
  if (features.hasQuoteIntent) return "request_quote";
  if (features.hasDelivery && features.hasMenuOrCatalog) return "order";
  if (features.hasBookingOrReservations && !features.hasMenuOrCatalog) return "book";
  if (features.hasBookingOrReservations && features.hasMenuOrCatalog) return "reserve";
  if (features.hasMenuOrCatalog) return "visit";
  if (features.requiresCredentials) return "call";
  if (features.hasServicePages) return "call";
  return "visit";
}

function inferTrustMode(
  analysis: WebsiteAnalysis,
  requiresCredentials: boolean
): TrustMode {
  const credentialStrength = requiresCredentials ? 2 : 0;
  const socialProofStrength = analysis.hasTestimonials ? 2 : 0;

  if (credentialStrength > 0 && socialProofStrength > 0) return "mixed";
  if (credentialStrength >= 2) return "regulated";
  if (socialProofStrength >= 2) return "consumer_social_proof";
  return "low_trust_barrier";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Infer a normalized BusinessFeatures object from extracted website data.
 * Deterministic — no LLM calls.
 *
 * This is the primary guardrail for all downstream generators.
 * Features override category-level assumptions.
 */
export function inferBusinessFeatures(analysis: WebsiteAnalysis): BusinessFeatures {
  const text = buildFullText(analysis);
  const evidence: Record<string, string> = {};

  // Menu / catalog
  const menuMatch = containsAny(text, MENU_SIGNALS);
  const hasMenuOrCatalog = menuMatch.matched;
  if (menuMatch.matched) evidence.menu = `detected: "${menuMatch.signal}"`;

  // Service pages (from scraper signal + additional text check)
  const hasServicePages = analysis.hasServicePages;
  if (hasServicePages) evidence.servicePages = "service-oriented navigation links found";

  // Local intent
  const hasLocalIntent = analysis.hasLocationMention || containsAny(text, [
    "city", "state", "neighborhood", "district", "street", "avenue",
    "zip", "address", "near you", "near me",
  ]).matched;

  // Hours expectation
  const hasHoursExpectation = analysis.hasHours;

  // Contact expectation
  const hasContactExpectation = analysis.hasContactInfo;

  // Booking / reservations
  const bookingMatch = containsAny(text, BOOKING_SIGNALS);
  const hasBookingOrReservations = bookingMatch.matched;
  if (bookingMatch.matched) evidence.booking = `detected: "${bookingMatch.signal}"`;

  // Quote intent — strict match required (not just "pricing")
  const quoteMatch = containsAny(text, QUOTE_SIGNALS);
  const hasQuoteIntent = quoteMatch.matched;
  if (quoteMatch.matched) evidence.quote = `detected: "${quoteMatch.signal}"`;
  else evidence.quote = "no quote/estimate language detected";

  // Delivery
  const deliveryMatch = containsAny(text, DELIVERY_SIGNALS);
  const hasDelivery = deliveryMatch.matched;
  if (deliveryMatch.matched) evidence.delivery = `detected: "${deliveryMatch.signal}"`;

  // Credentials — strict match (not just "award")
  const credentialMatch = containsAny(text, CREDENTIAL_SIGNALS);
  const requiresCredentials = credentialMatch.matched;
  if (credentialMatch.matched) evidence.credentials = `detected: "${credentialMatch.signal}"`;
  else evidence.credentials = "no license/insurance language detected";

  // Detected business terms for query generation
  const detectedBusinessTerms = detectBusinessTerms(text);
  if (detectedBusinessTerms.length > 0) {
    evidence.businessTerms = detectedBusinessTerms.join(", ");
  }

  const partial = {
    hasMenuOrCatalog,
    hasServicePages,
    hasLocalIntent,
    hasHoursExpectation,
    hasContactExpectation,
    hasBookingOrReservations,
    hasQuoteIntent,
    hasDelivery,
    requiresCredentials,
    detectedBusinessTerms,
  };

  const primaryConversion = inferPrimaryConversion(partial);
  const trustMode = inferTrustMode(analysis, requiresCredentials);
  evidence.primaryConversion = primaryConversion;
  evidence.trustMode = trustMode;

  return {
    ...partial,
    primaryConversion,
    trustMode,
    featureEvidence: evidence,
  };
}
