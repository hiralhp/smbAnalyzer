// ─────────────────────────────────────────────────────────────────────────────
// Business Profile Templates
//
// Static config driving the multi-dimensional BusinessProfile classification.
// Replaces archetype-templates.ts as the active classification config.
//
// Consumed by: business-profile-classifier.ts, scoring.ts,
//              faq-generator.ts, query-coverage.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis, BusinessModel } from "@/lib/types";

// Re-export DEFAULT_WEIGHTS and CategoryScoreWeights from archetype-templates
// so scoring.ts can import from a single source.
export { DEFAULT_WEIGHTS } from "./archetype-templates";
export type { CategoryScoreWeights } from "./archetype-templates";

// ── Business model config ─────────────────────────────────────────────────────

/**
 * Per-model config that parameterizes what "primary offering content" means.
 * Drives: scoring's service specificity check, recommendation text, query intents.
 */
export interface BusinessModelConfig {
  /** Model-specific query type strings appended to query coverage templates */
  queryIntents: string[];
  /** True when the business has its primary offering content present */
  checkOfferingContent(analysis: WebsiteAnalysis): boolean;
  /** Human-readable label for the offering content (e.g. "menu", "room listings") */
  offeringContentLabel: string;
  /** Rec title/description when offering content is missing */
  offeringContentRec: { title: string; description: string };
}

export const BUSINESS_MODEL_CONFIGS: Record<BusinessModel, BusinessModelConfig> = {
  venue_experience: {
    queryIntents: ["menu", "hours", "reservations", "delivery"],
    checkOfferingContent: (a) => a.hasPricing,
    offeringContentLabel: "menu with pricing",
    offeringContentRec: {
      title: "Add prices to your menu",
      description:
        "Displaying prices builds trust and helps AI match your business to budget-specific searches. Even approximate ranges work.",
    },
  },
  accommodation: {
    queryIntents: ["rooms", "rates", "availability", "amenities"],
    checkOfferingContent: (a) =>
      a.hasPricing ||
      (a.bodyTextSample ?? "").toLowerCase().includes("rooms") ||
      (a.bodyTextSample ?? "").toLowerCase().includes("suites"),
    offeringContentLabel: "room listings and rates",
    offeringContentRec: {
      title: "Add room rates and availability",
      description:
        "Guests want to see rates before booking. Adding room rates and availability helps AI answer pricing questions and improves conversion.",
    },
  },
  transactional_service: {
    queryIntents: ["free estimate", "service area", "emergency service", "licensed"],
    checkOfferingContent: (a) => a.hasServicePages,
    offeringContentLabel: "service pages",
    offeringContentRec: {
      title: "Create a page for each service",
      description:
        "Build a separate page for each core service you offer. Each page should cover: what the service is, who needs it, your process, and pricing range. This is the top driver of AI service-query matching.",
    },
  },
  appointment_based: {
    queryIntents: ["book appointment", "services", "pricing", "availability"],
    checkOfferingContent: (a) => a.hasServicePages,
    offeringContentLabel: "services/treatments page",
    offeringContentRec: {
      title: "Add a services/treatments page",
      description:
        "Patients and clients search for specific treatments. A dedicated page for each service dramatically improves AI discoverability for appointment-based queries.",
    },
  },
  retail_product: {
    queryIntents: ["shop", "products", "delivery", "returns"],
    checkOfferingContent: (a) => a.hasPricing,
    offeringContentLabel: "product listings with pricing",
    offeringContentRec: {
      title: "Add product listings with prices",
      description:
        "Shoppers search for specific products at specific prices. Listing your products with pricing helps AI recommend you for product-specific queries.",
    },
  },
  professional_advisory: {
    queryIntents: ["free consultation", "practice areas", "fees", "credentials"],
    checkOfferingContent: (a) => a.hasServicePages && a.hasTrustSignals,
    offeringContentLabel: "practice area pages with credentials",
    offeringContentRec: {
      title: "List your practice areas with credentials",
      description:
        "Clients search for specific expertise. Create a page per practice area or service, and prominently display your licenses, certifications, and years of experience.",
    },
  },
  unknown: {
    queryIntents: [],
    checkOfferingContent: () => true, // no-op — never fire offering content gap for unknown
    offeringContentLabel: "offering content",
    offeringContentRec: {
      title: "Create dedicated offering pages",
      description:
        "Add pages that detail your services, menu, or products to improve AI discoverability.",
    },
  },
};

// ── Sector detection thresholds ───────────────────────────────────────────────

/** Minimum raw weighted keyword score to assign a sector at all */
export const SECTOR_MIN_SCORE = 3;
/** Raw score threshold for medium confidence */
export const SECTOR_MEDIUM_SCORE = 5;
/** Raw score threshold for high confidence */
export const SECTOR_HIGH_SCORE = 9;

// ── Form category → sector mapping ────────────────────────────────────────────

export const SECTOR_FORM_MAP: Record<string, string> = {
  "HVAC / Home Services":      "home_services",
  "Plumbing":                  "home_services",
  "Electrical":                "home_services",
  "Roofing":                   "home_services",
  "Landscaping / Lawn Care":   "home_services",
  "Cleaning Services":         "home_services",
  "Pest Control":              "home_services",
  "Auto Repair":               "home_services",
  "Dentist / Dental Practice": "health_wellness",
  "Medical / Healthcare":      "health_wellness",
  "Legal / Law Firm":          "professional_services",
  "Accounting / Financial":    "professional_services",
  "Real Estate":               "professional_services",
  "Hotel / Hospitality":       "hospitality",
  "Restaurant / Food":         "food_and_beverage",
  "Retail":                    "retail_store",
  "Fitness / Gym":             "fitness",
  "Salon / Beauty":            "health_wellness",
  "Pet Services":              "home_services",
  "Childcare / Education":     "professional_services",
};

// ── Business model → FAQ sector fallback map ──────────────────────────────────

export const BUSINESS_MODEL_FAQ_MAP: Partial<Record<BusinessModel, string>> = {
  venue_experience:       "food_and_beverage",
  accommodation:          "hospitality",
  transactional_service:  "home_services",
  appointment_based:      "health_wellness",
  retail_product:         "retail_store",
  professional_advisory:  "professional_services",
  // "unknown" intentionally omitted → generic fallback
};

// ── Sector keyword lists ──────────────────────────────────────────────────────
// Focused 10–15 unambiguous keywords per sector.
// Scoring: title/H1 hit = 3 pts, H2 hit = 2 pts, body hit = 1 pt.

export const SECTOR_KEYWORDS: Record<string, string[]> = {
  food_and_beverage: [
    "menu", "restaurant", "cafe", "café", "coffee", "dining", "cuisine",
    "takeout", "delivery", "brunch", "espresso", "latte", "reservations",
  ],
  retail_store: [
    "shop", "store", "boutique", "merchandise", "collection", "add to cart",
    "free shipping", "in stock", "inventory", "shopping",
  ],
  professional_services: [
    "attorney", "law firm", "legal", "accountant", "cpa", "financial advisor",
    "consultant", "practice area", "tax", "litigation",
  ],
  home_services: [
    "hvac", "plumbing", "electrical", "roofing", "landscaping", "contractor",
    "service area", "free estimate", "licensed", "insured", "handyman",
  ],
  health_wellness: [
    "dental", "dentist", "medical", "wellness", "health", "therapy",
    "treatment", "massage", "salon", "spa", "skin care", "hair",
  ],
  hospitality: [
    "hotel", "inn", "resort", "motel", "lodge", "check-in", "check-out",
    "room rate", "amenities", "bed and breakfast",
  ],
  fitness: [
    "gym", "fitness", "yoga", "pilates", "crossfit", "class schedule",
    "membership", "personal training", "workout", "studio",
  ],
};

// ── Sector query nouns (safe fallbacks for query generation) ──────────────────

export const SECTOR_NOUNS: Record<string, string> = {
  food_and_beverage:     "café",
  retail_store:          "shop",
  professional_services: "professional service",
  home_services:         "home service",
  health_wellness:       "wellness provider",
  hospitality:           "hotel",
  fitness:               "fitness studio",
};

// ── Subtype query nouns (more specific; checked before sector noun) ────────────

export const SUBTYPE_NOUNS: Partial<Record<string, string>> = {
  // Food subtypes
  restaurant:        "restaurant",
  cafe_coffee_shop:  "café",
  bakery:            "bakery",
  bar:               "bar",
  // Legacy detected-term subtypes (from business-features.ts detectedBusinessTerms)
  coffee_shop:       "café",
  cafe:              "café",
  coffee:            "café",
  pizza:             "pizzeria",
  sushi:             "sushi restaurant",
  // Home service subtypes
  plumber:           "plumber",
  electrician:       "electrician",
  HVAC:              "HVAC company",
  roofer:            "roofing company",
  // Healthcare subtypes
  dentist:           "dentist",
  // Beauty subtypes
  "hair salon":      "hair salon",
  "nail salon":      "nail salon",
  // Fitness subtypes
  "yoga studio":     "yoga studio",
  gym:               "gym",
};

// ── Food subtype signals (used by business-profile-classifier.ts) ─────────────
// Checked in priority order; first match wins.

export const FOOD_SUBTYPE_SIGNALS: Record<string, string[]> = {
  // Strong, venue-specific signals only — must dominate to override restaurant
  cafe_coffee_shop: [
    "coffee shop", "coffeehouse", "coffee house",
    "espresso bar", "roastery",
    "espresso", "latte", "cappuccino", "americano", "pour over", "cold brew",
    "specialty coffee", "drip coffee", "barista", "pour-over",
  ],
  bakery: [
    "bakery", "patisserie", "pastry shop",
    "sourdough", "baguette", "croissant", "danish",
    "baked goods", "artisan bread", "fresh-baked",
    "cake shop", "custom cakes",
  ],
  bar: [
    "cocktail bar", "wine bar", "sports bar",
    "craft beer", "brewery", "taproom", "brewpub",
    "happy hour", "cover charge", "draft beer",
  ],
  // Restaurant signals are intentionally broad — any match contributes to score
  restaurant: [
    "restaurant", "bistro", "steakhouse", "brasserie", "trattoria",
    "fine dining", "casual dining",
    "dinner", "lunch", "brunch", "dining",
    "dinner menu", "lunch menu", "brunch menu",
    "pasta", "pizza", "sushi", "ramen", "tacos", "burgers", "steak", "seafood",
    "cocktails", "wine list", "wine menu",
    "appetizer", "entrée", "entree",
    "tasting menu", "prix fixe",
    "reserve a table", "make a reservation", "reservations",
    "dining room",
  ],
};

// ── Sector score weights ──────────────────────────────────────────────────────

import type { CategoryScoreWeights } from "./archetype-templates";

export const SECTOR_WEIGHTS: Partial<Record<string, CategoryScoreWeights>> = {
  food_and_beverage: {
    contentClarity:      0.20,
    serviceSpecificity:  0.25,   // menu = service pages
    localRelevance:      0.25,   // location very important
    trustSignals:        0.15,
    faqDiscoverability:  0.15,
  },
  health_wellness: {
    contentClarity:      0.20,
    serviceSpecificity:  0.28,   // treatment pages critical
    localRelevance:      0.15,
    trustSignals:        0.27,   // credentials very important
    faqDiscoverability:  0.10,
  },
  home_services: {
    contentClarity:      0.20,
    serviceSpecificity:  0.25,   // service pages important
    localRelevance:      0.25,   // service area critical
    trustSignals:        0.20,   // licensed/insured matters
    faqDiscoverability:  0.10,
  },
  professional_services: {
    contentClarity:      0.20,
    serviceSpecificity:  0.30,   // practice area / service pages critical
    localRelevance:      0.15,
    trustSignals:        0.30,   // credentials + credentials
    faqDiscoverability:  0.05,
  },
  fitness: {
    contentClarity:      0.20,
    serviceSpecificity:  0.20,
    localRelevance:      0.20,
    trustSignals:        0.15,
    faqDiscoverability:  0.25,   // class/schedule FAQs very important
  },
};

// ── Sector FAQ questions ──────────────────────────────────────────────────────

export const SECTOR_FAQ_QUESTIONS: Record<string, string[]> = {
  food_and_beverage: [
    "What are your hours of operation?",
    "Where are you located and is there parking?",
    "Do you offer takeout or delivery?",
    "Can I see your menu online?",
    "Do you accept reservations?",
    "Do you have vegetarian, vegan, or gluten-free options?",
    "Do you host private events or parties?",
    "Are you open on holidays?",
    "Do you have a loyalty program or specials?",
    "How do I place an order?",
  ],
  home_services: [
    "What areas do you serve?",
    "Do you offer emergency or same-day service?",
    "Are you licensed and insured?",
    "Do you provide free estimates?",
    "How quickly can you respond to a service call?",
    "What brands or products do you work with?",
    "Do you offer maintenance plans or contracts?",
    "How much does a typical service call cost?",
    "Do you offer any guarantees or warranties on your work?",
    "Do you handle both residential and commercial properties?",
  ],
  health_wellness: [
    "Are you accepting new clients?",
    "How do I book an appointment?",
    "What services do you offer?",
    "What are your hours?",
    "Do you accept insurance?",
    "What should I bring or do to prepare for my appointment?",
    "What is your cancellation policy?",
    "Do you offer package deals or memberships?",
    "How much do your services cost?",
    "Do you offer gift cards?",
  ],
  fitness: [
    "Do you offer a free trial or introductory class?",
    "What classes or programs do you offer?",
    "What are your membership options and pricing?",
    "Do I need any experience to join?",
    "What are your hours?",
    "Do you offer personal training?",
    "Is childcare available?",
    "What should I bring to my first class?",
    "Do you have locker rooms or showers?",
    "Can I pause or cancel my membership?",
  ],
  professional_services: [
    "Do you offer free consultations?",
    "What types of clients or cases do you handle?",
    "How do you charge for your services?",
    "How do I get started?",
    "What should I bring to my first meeting?",
    "Are you licensed and accredited?",
    "What is the best way to reach you?",
    "Do you offer payment plans?",
    "How long does a typical engagement take?",
    "Do you serve clients outside of [city]?",
  ],
  retail_store: [
    "What products do you carry?",
    "Do you offer online shopping or local delivery?",
    "What are your store hours?",
    "What is your return policy?",
    "Do you offer gift wrapping or gift cards?",
    "Do you ship nationally?",
    "How can I check if an item is in stock?",
    "Do you offer loyalty rewards?",
    "Can I place a custom or special order?",
    "Where are you located?",
  ],
  hospitality: [
    "What are your check-in and check-out times?",
    "What amenities do you offer?",
    "Do you have parking?",
    "What is your cancellation policy?",
    "Do you allow pets?",
    "Is breakfast included?",
    "How far are you from local attractions?",
    "Do you offer group rates or event packages?",
    "Is there a pool or fitness center?",
    "How do I make a reservation?",
  ],
  generic: [
    "What services do you offer?",
    "Where are you located?",
    "What are your hours of operation?",
    "How do I get in touch with you?",
    "Do you offer a free consultation or estimate?",
    "How long have you been in business?",
    "What areas do you serve?",
    "How do I book an appointment or get started?",
    "What makes you different from competitors?",
    "Do you offer any guarantees or warranties?",
  ],
};

// ── Subtype FAQ questions ─────────────────────────────────────────────────────
// Only for high-value subtypes worth specializing (detected via BusinessFeatures).

export const SUBTYPE_FAQ_QUESTIONS: Partial<Record<string, string[]>> = {
  // cafe_coffee_shop is the canonical subtype key from the classifier;
  // coffee_shop is kept for backward compatibility.
  cafe_coffee_shop: [
    "What coffee drinks do you offer?",
    "Do you have non-dairy milk options?",
    "Do you offer food or pastries?",
    "Do you have WiFi?",
    "What are your hours?",
    "Where are you located?",
    "Do you offer loyalty rewards?",
    "Do you sell whole bean or ground coffee?",
    "Can I book a private event or meeting here?",
    "Do you offer seasonal drinks?",
  ],
  coffee_shop: [
    "What coffee drinks do you offer?",
    "Do you have non-dairy milk options?",
    "Do you offer food or pastries?",
    "Do you have WiFi?",
    "What are your hours?",
    "Where are you located?",
    "Do you offer loyalty rewards?",
    "Do you sell whole bean or ground coffee?",
    "Can I book a private event or meeting here?",
    "Do you offer seasonal drinks?",
  ],
  restaurant: [
    "Do you accept reservations?",
    "What are your hours of operation?",
    "Do you offer takeout or delivery?",
    "Do you have vegetarian or vegan options?",
    "Where are you located and is there parking?",
    "Do you host private events or parties?",
    "Do you have a kids menu?",
    "Are you open on holidays?",
    "Can I order online?",
    "Do you have a happy hour or daily specials?",
  ],
  dentist: [
    "Are you accepting new patients?",
    "What dental insurance do you accept?",
    "Do you offer emergency dental appointments?",
    "How often should I come in for cleanings?",
    "Do you offer teeth whitening?",
    "What are your office hours?",
    "Do you treat children?",
    "Do you offer payment plans or financing?",
    "What should I bring to my first appointment?",
    "Do you offer Invisalign or orthodontic treatment?",
  ],
  hvac: [
    "What areas do you serve?",
    "Do you offer emergency HVAC service?",
    "Are you licensed and insured?",
    "Do you provide free estimates?",
    "Do you service all HVAC brands?",
    "How much does a typical service call cost?",
    "Do you offer maintenance plans or tune-ups?",
    "How quickly can you respond?",
    "Do you handle both residential and commercial HVAC?",
    "Do you offer any warranties on parts and labor?",
  ],
  lawyer: [
    "Do you offer free consultations?",
    "What types of cases do you handle?",
    "How do you charge for your services?",
    "How long does a typical case take?",
    "What should I bring to my first meeting?",
    "Are you admitted to the state bar?",
    "Do you handle cases outside of [city]?",
    "What is the best way to reach you?",
    "Do you offer payment plans?",
    "Can you explain the typical process for my type of case?",
  ],
  gym: [
    "What are your membership options and pricing?",
    "Do you offer a free trial?",
    "What equipment and amenities do you have?",
    "What are your hours?",
    "Do you offer personal training?",
    "Is childcare available?",
    "Do you have locker rooms and showers?",
    "Can I pause or cancel my membership?",
    "Do you offer group fitness classes?",
    "What is the guest policy?",
  ],
  bakery: [
    "What baked goods do you offer?",
    "What are your hours?",
    "Do you take custom cake or pastry orders?",
    "Do you offer gluten-free or vegan options?",
    "How far in advance should I place a custom order?",
    "Do you offer catering or wholesale orders?",
    "Where are you located?",
    "Do you offer online ordering or local delivery?",
    "Do you sell whole loaves of bread?",
    "Are you open on weekends?",
  ],
  bar: [
    "What are your hours?",
    "Do you take reservations?",
    "What's on your cocktail or drink menu?",
    "Do you serve food?",
    "Is there a cover charge?",
    "Do you have a happy hour?",
    "Can I book a private event or buy out the bar?",
    "Is there parking nearby?",
    "What is your dress code?",
    "Do you have a full bar or beer and wine only?",
  ],
};
