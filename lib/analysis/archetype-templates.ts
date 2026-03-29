// ─────────────────────────────────────────────────────────────────────────────
// Archetype Templates
//
// Two-level classification: archetype (broad family) + subtype (specific type).
// Subtype is only used when confidence >= threshold AND separation from 2nd-best >= min.
//
// Consumed by: archetype-classifier.ts, scoring.ts, faq-generator.ts, query-coverage.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { BusinessArchetype } from "@/lib/types";

// ── Classification thresholds ─────────────────────────────────────────────────

export const SUBTYPE_CONFIDENCE_THRESHOLD = 0.65;
export const SUBTYPE_SEPARATION_MIN = 0.15;
export const ARCHETYPE_MIN_SCORE = 2;

// ── Form category → archetype mapping ────────────────────────────────────────

export const ARCHETYPE_FORM_MAP: Record<string, BusinessArchetype> = {
  "HVAC / Home Services":      "home_service",
  "Plumbing":                  "home_service",
  "Electrical":                "home_service",
  "Roofing":                   "home_service",
  "Landscaping / Lawn Care":   "home_service",
  "Cleaning Services":         "home_service",
  "Pest Control":              "home_service",
  "Auto Repair":               "automotive",
  "Dentist / Dental Practice": "health_beauty",
  "Medical / Healthcare":      "health_beauty",
  "Legal / Law Firm":          "professional_service",
  "Accounting / Financial":    "professional_service",
  "Real Estate":               "professional_service",
  "Restaurant / Food":         "food_drink",
  "Retail":                    "retail",
  "Fitness / Gym":             "fitness",
  "Salon / Beauty":            "health_beauty",
  "Pet Services":              "local_service",
  "Childcare / Education":     "education",
  "Other":                     "generic_unknown",
};

// ── Archetype keyword lists ───────────────────────────────────────────────────
// Conservative, unambiguous signals per archetype.
// Keywords should be distinctive to the archetype, not shared across many types.

export const ARCHETYPE_KEYWORDS: Record<BusinessArchetype, string[]> = {
  food_drink: [
    "menu", "dining", "cuisine", "chef", "dine", "bistro", "eatery",
    "reservation", "takeout", "delivery", "brunch", "breakfast", "dinner",
    "lunch", "espresso", "latte", "cappuccino", "barista", "roast",
    "cocktail", "tap beer", "wine list",
  ],
  home_service: [
    "hvac", "plumbing", "electrical", "roofing", "landscaping", "pest control",
    "heating", "cooling", "air conditioning", "furnace", "plumber", "electrician",
    "roofer", "lawn mowing", "duct cleaning", "handyman", "contractor",
    "licensed insured", "service area", "free estimate",
  ],
  health_beauty: [
    "dental", "dentist", "orthodontic", "botox", "filler", "aesthetic",
    "med spa", "medspa", "skin care", "facial", "laser treatment",
    "hair salon", "nail salon", "manicure", "pedicure", "waxing", "lash",
    "chiropractic", "massage therapy", "spa treatment",
  ],
  fitness: [
    "gym membership", "personal training", "yoga class", "crossfit", "pilates",
    "spin class", "bootcamp", "class schedule", "workout program",
    "strength training", "cardio", "fitness studio", "martial arts",
  ],
  professional_service: [
    "attorney", "law firm", "legal counsel", "litigation", "practice area",
    "cpa", "certified public accountant", "tax preparation", "bookkeeping",
    "financial advisor", "wealth management", "investment planning",
    "real estate agent", "property listing",
  ],
  automotive: [
    "auto repair", "car repair", "oil change", "tire rotation", "brake service",
    "transmission", "mechanic", "car wash", "detailing", "dealership",
    "vehicle service", "auto body", "collision repair",
  ],
  education: [
    "daycare", "preschool", "tutoring", "learning center", "childcare",
    "afterschool", "kindergarten", "nursery", "music lesson", "instrument",
    "music school", "early childhood",
  ],
  retail: [
    "boutique", "merchandise", "collection", "inventory", "shop online",
    "add to cart", "free shipping", "return policy", "storefront",
  ],
  hospitality: [
    "hotel", "motel", "inn", "bed and breakfast", "resort", "lodge",
    "check-in", "check-out", "room rate", "amenities", "concierge",
  ],
  local_service: [
    "veterinary", "vet clinic", "dog grooming", "pet boarding", "kennel",
    "doggy daycare", "moving company", "junk removal", "locksmith",
    "photography", "event planning",
  ],
  events: [
    "event venue", "banquet hall", "wedding venue", "catering", "event space",
    "private event", "corporate event", "party planning",
  ],
  generic_unknown: [],
};

// ── Subtype definition ────────────────────────────────────────────────────────

export interface SubtypeDefinition {
  name: string;
  /** Distinctive keywords that separate this subtype from others in the archetype */
  keywords: string[];
  /** Query noun used only when subtypeConfidence >= threshold */
  noun: string;
}

// ── Archetype subtypes ────────────────────────────────────────────────────────
// Only archetypes with meaningful subtypes are listed here.
// Keywords must be DISTINGUISHING within the archetype (e.g., "menu" alone is
// not enough to separate restaurant from coffee_shop within food_drink).

export const ARCHETYPE_SUBTYPES: Partial<Record<BusinessArchetype, SubtypeDefinition[]>> = {
  food_drink: [
    {
      name: "coffee_shop",
      keywords: ["coffee", "espresso", "latte", "cappuccino", "cold brew", "barista", "roast", "pour over"],
      noun: "coffee shop",
    },
    {
      name: "bakery",
      keywords: ["bakery", "pastry", "bread", "baked goods", "croissant", "cake", "muffin", "scone"],
      noun: "bakery",
    },
    {
      name: "bar",
      keywords: ["bar", "pub", "cocktail", "tap beer", "craft beer", "draft", "spirits", "happy hour drinks"],
      noun: "bar",
    },
    {
      name: "restaurant",
      keywords: ["restaurant", "dining", "cuisine", "reservation", "dinner menu", "lunch menu", "dine in", "chef"],
      noun: "restaurant",
    },
    {
      name: "cafe",
      keywords: ["cafe", "café", "light bites", "quiche", "sandwich", "soup", "brunch menu"],
      noun: "café",
    },
  ],
  home_service: [
    {
      name: "hvac",
      keywords: ["hvac", "heating", "cooling", "air conditioning", "furnace", "heat pump", "duct", "ac repair"],
      noun: "HVAC contractor",
    },
    {
      name: "plumber",
      keywords: ["plumbing", "plumber", "pipe", "drain", "water heater", "sewer", "leak repair"],
      noun: "plumber",
    },
    {
      name: "electrician",
      keywords: ["electrical", "electrician", "wiring", "panel", "circuit", "outlet", "lighting installation"],
      noun: "electrician",
    },
    {
      name: "roofer",
      keywords: ["roofing", "roofer", "roof repair", "shingle", "gutter", "roof replacement"],
      noun: "roofing contractor",
    },
    {
      name: "landscaper",
      keywords: ["landscaping", "lawn care", "mowing", "lawn maintenance", "irrigation", "sod", "hardscape"],
      noun: "landscaper",
    },
    {
      name: "pest_control",
      keywords: ["pest control", "exterminator", "termite", "rodent", "bed bug", "infestation"],
      noun: "pest control service",
    },
    {
      name: "cleaning",
      keywords: ["cleaning service", "house cleaning", "maid service", "deep clean", "janitorial", "move-out clean"],
      noun: "cleaning service",
    },
  ],
  health_beauty: [
    {
      name: "dentist",
      keywords: ["dental", "dentist", "teeth", "tooth", "orthodontic", "cavity", "crown", "implant", "oral health"],
      noun: "dentist",
    },
    {
      name: "med_spa",
      keywords: ["botox", "filler", "injection", "laser", "aesthetic", "med spa", "medspa", "anti-aging", "coolsculpting"],
      noun: "med spa",
    },
    {
      name: "hair_salon",
      keywords: ["hair", "haircut", "color", "highlights", "balayage", "blowout", "stylist", "hair salon"],
      noun: "hair salon",
    },
    {
      name: "nail_salon",
      keywords: ["nail", "manicure", "pedicure", "gel nails", "acrylic", "nail salon"],
      noun: "nail salon",
    },
    {
      name: "massage",
      keywords: ["massage", "massage therapy", "deep tissue", "swedish", "sports massage", "relaxation massage"],
      noun: "massage therapist",
    },
    {
      name: "chiropractor",
      keywords: ["chiropractic", "chiropractor", "adjustment", "spinal", "back pain", "neck pain"],
      noun: "chiropractor",
    },
  ],
  fitness: [
    {
      name: "yoga_studio",
      keywords: ["yoga", "vinyasa", "hot yoga", "hatha", "meditation", "mindfulness", "yoga class"],
      noun: "yoga studio",
    },
    {
      name: "crossfit",
      keywords: ["crossfit", "wod", "box", "functional fitness", "olympic lifting"],
      noun: "CrossFit gym",
    },
    {
      name: "pilates",
      keywords: ["pilates", "reformer", "mat pilates", "pilates studio"],
      noun: "Pilates studio",
    },
    {
      name: "gym",
      keywords: ["gym", "weightlifting", "cardio equipment", "free weights", "treadmill", "locker room", "membership"],
      noun: "gym",
    },
    {
      name: "martial_arts",
      keywords: ["martial arts", "karate", "jiu jitsu", "taekwondo", "boxing", "mma", "dojo"],
      noun: "martial arts school",
    },
  ],
  professional_service: [
    {
      name: "lawyer",
      keywords: ["attorney", "law firm", "lawyer", "legal", "litigation", "case", "practice area", "counsel"],
      noun: "attorney",
    },
    {
      name: "accountant",
      keywords: ["accounting", "cpa", "tax", "bookkeeping", "audit", "payroll", "financial statement"],
      noun: "accountant",
    },
    {
      name: "financial_advisor",
      keywords: ["financial advisor", "wealth management", "investment", "retirement planning", "portfolio"],
      noun: "financial advisor",
    },
    {
      name: "real_estate",
      keywords: ["real estate", "realtor", "property listing", "home buying", "home selling", "mls"],
      noun: "real estate agent",
    },
  ],
  automotive: [
    {
      name: "auto_repair",
      keywords: ["auto repair", "car repair", "mechanic", "oil change", "brake", "transmission", "engine"],
      noun: "auto repair shop",
    },
    {
      name: "car_wash",
      keywords: ["car wash", "detailing", "hand wash", "wax", "interior cleaning", "ceramic coat"],
      noun: "car wash",
    },
    {
      name: "dealership",
      keywords: ["dealership", "new cars", "used cars", "test drive", "financing", "trade-in"],
      noun: "car dealership",
    },
  ],
  education: [
    {
      name: "preschool",
      keywords: ["preschool", "daycare", "childcare", "early childhood", "toddler", "infant care", "nursery"],
      noun: "preschool",
    },
    {
      name: "tutoring",
      keywords: ["tutoring", "tutor", "academic help", "homework help", "test prep", "learning center"],
      noun: "tutoring center",
    },
    {
      name: "music_school",
      keywords: ["music lesson", "music school", "instrument", "piano lesson", "guitar lesson", "voice lesson"],
      noun: "music school",
    },
  ],
};

// ── Archetype nouns (safe fallbacks) ─────────────────────────────────────────
// Used when subtype is null or subtypeConfidence is below threshold.
// Must be generic enough to not be wrong for any subtype.

export const ARCHETYPE_NOUNS: Record<BusinessArchetype, string> = {
  food_drink:           "café",         // safe — not wrong for coffee shops or eateries
  home_service:         "home service",
  health_beauty:        "health & beauty",
  fitness:              "fitness studio",
  professional_service: "professional service",
  automotive:           "auto service",
  education:            "learning center",
  retail:               "shop",
  hospitality:          "hotel",
  local_service:        "local service",
  events:               "event venue",
  generic_unknown:      "business",
};

// ── Score weights ─────────────────────────────────────────────────────────────

export interface CategoryScoreWeights {
  contentClarity: number;
  serviceSpecificity: number;
  localRelevance: number;
  trustSignals: number;
  faqDiscoverability: number;
}

export const DEFAULT_WEIGHTS: CategoryScoreWeights = {
  contentClarity: 0.25,
  serviceSpecificity: 0.20,
  localRelevance: 0.20,
  trustSignals: 0.20,
  faqDiscoverability: 0.15,
};

export const ARCHETYPE_WEIGHTS: Partial<Record<BusinessArchetype, CategoryScoreWeights>> = {
  food_drink: {
    contentClarity: 0.20,
    serviceSpecificity: 0.25,   // menu = service pages
    localRelevance: 0.25,       // location very important
    trustSignals: 0.15,
    faqDiscoverability: 0.15,
  },
  health_beauty: {
    contentClarity: 0.20,
    serviceSpecificity: 0.28,   // treatment pages critical
    localRelevance: 0.15,
    trustSignals: 0.27,         // credentials very important
    faqDiscoverability: 0.10,
  },
  home_service: {
    contentClarity: 0.20,
    serviceSpecificity: 0.25,   // service pages important
    localRelevance: 0.25,       // service area critical
    trustSignals: 0.20,         // licensed/insured matters
    faqDiscoverability: 0.10,
  },
  professional_service: {
    contentClarity: 0.20,
    serviceSpecificity: 0.30,   // practice area / service pages critical
    localRelevance: 0.15,
    trustSignals: 0.30,         // credentials + credentials
    faqDiscoverability: 0.05,
  },
  fitness: {
    contentClarity: 0.20,
    serviceSpecificity: 0.20,
    localRelevance: 0.20,
    trustSignals: 0.15,
    faqDiscoverability: 0.25,   // class/schedule FAQs very important
  },
  health_beauty_salon: {  // unused key — salon uses health_beauty
    contentClarity: 0.20,
    serviceSpecificity: 0.25,
    localRelevance: 0.20,
    trustSignals: 0.15,
    faqDiscoverability: 0.20,
  },
} as Partial<Record<BusinessArchetype, CategoryScoreWeights>>;

// ── Recommendation template interface ────────────────────────────────────────

export interface RecTemplate {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}

// ── Archetype recommendation overrides ───────────────────────────────────────
// Keys are ruleIds from scoring.ts

export const ARCHETYPE_REC_OVERRIDES: Partial<Record<BusinessArchetype, Partial<Record<string, RecTemplate>>>> = {
  food_drink: {
    service_pages_present: {
      title: "Add a full menu to your website",
      description:
        "A complete menu with prices is the single most important page for any food & drink business. AI assistants pull menu data to answer 'what do they serve' and 'how much does it cost' queries. Include sections for all offerings.",
      impact: "high",
      effort: "low",
    },
    pricing_language: {
      title: "Add prices to your menu",
      description:
        "Displaying prices builds trust and helps AI match your business to budget-specific searches. Even approximate ranges work.",
      impact: "high",
      effort: "low",
    },
    hours_present: {
      title: "Add your hours prominently",
      description:
        "Hours are critical — customers ask AI assistants 'is [business] open now?' constantly. Put your hours in the header or hero section.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a FAQ section",
      description:
        "Common questions like 'Do you take reservations?', 'Is there parking?', 'Do you offer takeout?' are frequently asked to AI assistants. A FAQ page lets AI answer these for you.",
      impact: "medium",
      effort: "low",
    },
  },
  health_beauty: {
    service_pages_present: {
      title: "Create pages for each treatment or service",
      description:
        "Patients and clients search for specific treatments — 'teeth whitening near me', 'balayage in [city]'. A dedicated page for each service dramatically improves AI discoverability.",
      impact: "high",
      effort: "medium",
    },
    trust_keywords_present: {
      title: "Display your credentials and certifications",
      description:
        "Clients trust credentials. List your education, certifications, specializations, and years of experience. AI assistants use credential language to recommend health & beauty providers.",
      impact: "high",
      effort: "low",
    },
    contact_info_present: {
      title: "Make your phone number prominent",
      description:
        "Clients almost always call or book online. Your phone number should be in the header, footer, and near every call-to-action.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a FAQ page",
      description:
        "AI assistants frequently answer questions about your services. A FAQ covering insurance, booking, new client procedures, and services positions your business as the source of truth.",
      impact: "high",
      effort: "low",
    },
  },
  home_service: {
    service_pages_present: {
      title: "Create a page for each service you offer",
      description:
        "Build separate pages for each service (e.g., AC repair, furnace installation, duct cleaning). Each page should cover: what it is, who needs it, your process, and pricing range. This is the top driver of AI service-query matching.",
      impact: "high",
      effort: "medium",
    },
    trust_keywords_present: {
      title: "Prominently display your license and insurance",
      description:
        "Homeowners specifically look for licensed and insured contractors. Add 'Licensed, Bonded & Insured' to your header. Include your license number if your state requires it to be public.",
      impact: "high",
      effort: "low",
    },
    location_mention: {
      title: "Add a service area page or section",
      description:
        "Home service customers search by location. Create a 'Service Area' page listing every city and neighborhood you cover. This is a primary AI signal for matching 'near me' searches.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a service FAQ page",
      description:
        "Common questions like 'Do you offer free estimates?', 'Are you available for emergencies?', 'What areas do you serve?' are perfect FAQ content. AI systems pull this directly.",
      impact: "high",
      effort: "low",
    },
  },
  professional_service: {
    service_pages_present: {
      title: "Create a page for each service or practice area",
      description:
        "Clients search by specific need — 'divorce attorney in [city]', 'tax accountant near me'. A dedicated page per service area dramatically improves AI discoverability.",
      impact: "high",
      effort: "medium",
    },
    trust_keywords_present: {
      title: "Display your credentials and experience",
      description:
        "List your licenses, certifications, years of experience, and any awards. AI systems use credential language to recommend professional service providers.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a FAQ page",
      description:
        "Questions like 'Do you offer free consultations?', 'What types of clients do you serve?', 'How much do you charge?' are commonly asked to AI assistants. A FAQ page captures this intent.",
      impact: "high",
      effort: "low",
    },
  },
  fitness: {
    service_pages_present: {
      title: "Add pages for each class or program",
      description:
        "Members search for specific classes — 'yoga classes near me', 'crossfit [city]'. Individual class/program pages dramatically improve AI discoverability.",
      impact: "high",
      effort: "medium",
    },
    faq_present: {
      title: "Add a membership FAQ",
      description:
        "Common questions like 'What are your membership options?', 'Do you offer a free trial?', 'Can I cancel anytime?' are perfect FAQ content for fitness studios.",
      impact: "high",
      effort: "low",
    },
  },
};

// ── Archetype FAQ questions ───────────────────────────────────────────────────
// Archetype-level only — used unless subtype confidence is high

export const ARCHETYPE_FAQ_QUESTIONS: Record<BusinessArchetype, string[]> = {
  food_drink: [
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
  home_service: [
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
  health_beauty: [
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
  professional_service: [
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
  automotive: [
    "What services do you offer?",
    "Do you provide estimates before starting work?",
    "How long does a typical service take?",
    "Do you offer a warranty on your work?",
    "Do I need an appointment or do you accept walk-ins?",
    "What are your hours?",
    "Do you offer loaner cars or shuttle service?",
    "What types of vehicles do you service?",
    "Do you work with insurance companies?",
    "How do I schedule an appointment?",
  ],
  education: [
    "What age groups do you serve?",
    "What are your operating hours?",
    "What is your enrollment process?",
    "What curriculum or programs do you offer?",
    "What are your fees or tuition?",
    "Do you offer part-time or flexible scheduling?",
    "Are your staff certified or credentialed?",
    "What is your student-to-teacher or staff ratio?",
    "How do I schedule a tour or trial lesson?",
    "Are you licensed or accredited?",
  ],
  retail: [
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
    "How far are you from [local attraction]?",
    "Do you offer group rates or event packages?",
    "Is there a pool or fitness center?",
    "How do I make a reservation?",
  ],
  local_service: [
    "What services do you offer?",
    "What areas do you serve?",
    "How do I schedule an appointment?",
    "What are your hours?",
    "How much do your services cost?",
    "Are you licensed and insured?",
    "Do you offer free estimates?",
    "What should I expect during my first visit?",
    "Do you offer any guarantees?",
    "How do I get in touch with you?",
  ],
  events: [
    "What types of events do you host?",
    "What is your capacity?",
    "Do you offer catering?",
    "What is included in your venue rental?",
    "How far in advance should I book?",
    "Do you have a preferred vendor list?",
    "What are your hours for events?",
    "Do you offer packages for weddings or corporate events?",
    "Is there parking available?",
    "How do I schedule a tour?",
  ],
  generic_unknown: [
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
// Only used when subtypeConfidence >= SUBTYPE_CONFIDENCE_THRESHOLD

export const SUBTYPE_FAQ_QUESTIONS: Partial<Record<string, string[]>> = {
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
  bakery: [
    "What baked goods do you offer?",
    "Can I order custom cakes or pastries?",
    "What are your hours?",
    "Do you offer gluten-free or vegan options?",
    "Do you deliver or ship?",
    "How far in advance should I place a custom order?",
    "Where are you located?",
    "Do you cater events?",
    "Do you offer seasonal or holiday specials?",
    "Are your products made fresh daily?",
  ],
  bar: [
    "What are your hours?",
    "Do you have a full menu of food?",
    "Do you have happy hour specials?",
    "Do you host private events or bar buyouts?",
    "What beers or cocktails do you specialize in?",
    "Is there a cover charge?",
    "Do you have live music or entertainment?",
    "What is your policy on reservations?",
    "Do you have a dress code?",
    "Where are you located?",
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
  med_spa: [
    "What treatments do you offer?",
    "How long do results typically last?",
    "Is a consultation required before treatment?",
    "What is your cancellation policy?",
    "Do you offer package deals or memberships?",
    "What are your qualifications and certifications?",
    "How do I prepare for my appointment?",
    "What is the recovery time for your treatments?",
    "Do you offer financing options?",
    "Are your treatments safe for all skin types?",
  ],
  hair_salon: [
    "Do I need an appointment or do you accept walk-ins?",
    "What services do you offer?",
    "How much does a haircut cost?",
    "Do you offer color or highlights?",
    "How far in advance should I book?",
    "What products do you use?",
    "Do you offer bridal packages?",
    "What is your cancellation policy?",
    "Do you color or treat natural hair?",
    "Do you have a loyalty program?",
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
  plumber: [
    "Do you offer emergency plumbing service?",
    "What areas do you serve?",
    "Are you licensed and insured?",
    "How much does a service call cost?",
    "Do you provide free estimates?",
    "What plumbing services do you offer?",
    "How quickly can you respond?",
    "Do you offer any guarantees on your work?",
    "Do you handle both residential and commercial plumbing?",
    "What brands of fixtures do you work with?",
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
  accountant: [
    "What accounting services do you offer?",
    "Do you work with individuals, businesses, or both?",
    "What are your fees?",
    "Are you a CPA?",
    "What software or tools do you use?",
    "Do you offer a free initial consultation?",
    "Do you specialize in any industries?",
    "Can you help with tax planning year-round?",
    "How do you communicate with clients?",
    "How do I get started?",
  ],
  yoga_studio: [
    "What yoga styles do you offer?",
    "Do you offer beginner classes?",
    "What are your class schedule and hours?",
    "What are your membership or class pass options?",
    "Do you rent mats or equipment?",
    "Do you offer private sessions?",
    "Is there a free trial or intro offer?",
    "Do you offer hot yoga?",
    "What should I bring to my first class?",
    "Do you have online or virtual classes?",
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
};
