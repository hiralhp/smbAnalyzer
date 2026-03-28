// ─────────────────────────────────────────────────────────────────────────────
// Category Templates
//
// Static per-category configuration consumed by:
//   - category-classifier.ts (keyword matching)
//   - scoring.ts (weights + category-specific recs)
//   - faq-generator.ts (question templates)
//   - query-coverage.ts (category noun)
//
// Categories are internal enums; they do NOT map 1:1 to form category strings.
// Use FORM_CATEGORY_MAP to convert user-provided category → canonical.
// ─────────────────────────────────────────────────────────────────────────────

export type CanonicalCategory =
  | "restaurant_cafe"
  | "dentist"
  | "med_spa"
  | "home_services"
  | "lawyer"
  | "salon"
  | "finance"
  | "fitness"
  | "retail"
  | "pet_services"
  | "childcare"
  | "generic";

// ── Form category → canonical mapping ────────────────────────────────────────

export const FORM_CATEGORY_MAP: Record<string, CanonicalCategory> = {
  "HVAC / Home Services":    "home_services",
  "Plumbing":                "home_services",
  "Electrical":              "home_services",
  "Roofing":                 "home_services",
  "Landscaping / Lawn Care": "home_services",
  "Cleaning Services":       "home_services",
  "Pest Control":            "home_services",
  "Auto Repair":             "home_services",
  "Dentist / Dental Practice": "dentist",
  "Medical / Healthcare":    "med_spa",
  "Legal / Law Firm":        "lawyer",
  "Accounting / Financial":  "finance",
  "Real Estate":             "generic",
  "Restaurant / Food":       "restaurant_cafe",
  "Retail":                  "retail",
  "Fitness / Gym":           "fitness",
  "Salon / Beauty":          "salon",
  "Pet Services":            "pet_services",
  "Childcare / Education":   "childcare",
  "Other":                   "generic",
};

// ── Score weights per category ────────────────────────────────────────────────
// Must sum to ~1.0. Defaults: content=0.25, service=0.20, local=0.20, trust=0.20, faq=0.15

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

export const CATEGORY_WEIGHTS: Partial<Record<CanonicalCategory, CategoryScoreWeights>> = {
  restaurant_cafe: {
    contentClarity: 0.20,
    serviceSpecificity: 0.25,   // menu = service pages
    localRelevance: 0.25,       // location very important
    trustSignals: 0.15,
    faqDiscoverability: 0.15,
  },
  dentist: {
    contentClarity: 0.20,
    serviceSpecificity: 0.25,   // treatment pages critical
    localRelevance: 0.15,
    trustSignals: 0.30,         // credentials very important for healthcare
    faqDiscoverability: 0.10,
  },
  med_spa: {
    contentClarity: 0.20,
    serviceSpecificity: 0.30,   // treatment menus critical
    localRelevance: 0.15,
    trustSignals: 0.25,         // credentials + reviews very important
    faqDiscoverability: 0.10,
  },
  home_services: {
    contentClarity: 0.20,
    serviceSpecificity: 0.25,   // service pages important
    localRelevance: 0.25,       // service area critical
    trustSignals: 0.20,         // licensed/insured matters
    faqDiscoverability: 0.10,
  },
  lawyer: {
    contentClarity: 0.20,
    serviceSpecificity: 0.30,   // practice area pages critical
    localRelevance: 0.15,
    trustSignals: 0.30,         // credentials + bar association
    faqDiscoverability: 0.05,
  },
  salon: {
    contentClarity: 0.20,
    serviceSpecificity: 0.25,   // services + pricing
    localRelevance: 0.20,
    trustSignals: 0.15,
    faqDiscoverability: 0.20,   // booking FAQs matter
  },
  fitness: {
    contentClarity: 0.20,
    serviceSpecificity: 0.20,
    localRelevance: 0.20,
    trustSignals: 0.15,
    faqDiscoverability: 0.25,   // class/schedule FAQs very important
  },
};

// ── Keyword classifiers ───────────────────────────────────────────────────────
// Used by category-classifier.ts for content-based inference

export const CATEGORY_KEYWORDS: Record<CanonicalCategory, string[]> = {
  restaurant_cafe: [
    "restaurant", "cafe", "coffee", "menu", "dining", "food", "eat", "lunch", "dinner",
    "breakfast", "brunch", "takeout", "delivery", "reservation", "dine", "bistro",
    "eatery", "cuisine", "chef", "order online", "bar", "pub",
  ],
  dentist: [
    "dental", "dentist", "teeth", "tooth", "orthodontic", "braces", "cavity",
    "filling", "crown", "implant", "cleaning", "whitening", "gum", "oral",
    "root canal", "extraction", "invisalign", "hygienist",
  ],
  med_spa: [
    "botox", "filler", "injection", "laser", "facial", "med spa", "medspa",
    "aesthetic", "skin care", "skincare", "rejuvenation", "anti-aging", "chemical peel",
    "microneedling", "coolsculpting", "kybella", "prp",
  ],
  home_services: [
    "hvac", "plumbing", "electrical", "roofing", "landscaping", "pest control",
    "cleaning service", "heating", "cooling", "air conditioning", "furnace",
    "plumber", "electrician", "roofer", "lawn", "mowing", "repair", "installation",
    "contractor", "handyman",
  ],
  lawyer: [
    "attorney", "law firm", "legal", "litigation", "counsel", "practice area",
    "lawyer", "lawsuit", "settlement", "divorce", "criminal", "injury",
    "immigration", "estate", "business law", "consultation",
  ],
  salon: [
    "hair", "nail", "beauty", "blowout", "color", "cut", "salon", "barber",
    "stylist", "manicure", "pedicure", "waxing", "eyebrow", "lash", "spa",
    "threading", "highlights",
  ],
  finance: [
    "accounting", "tax", "financial", "cpa", "bookkeeping", "investment",
    "wealth management", "insurance", "mortgage", "loan", "financial advisor",
    "audit", "payroll", "quickbooks",
  ],
  fitness: [
    "gym", "fitness", "workout", "personal training", "yoga", "crossfit",
    "pilates", "spin", "weights", "cardio", "strength", "bootcamp",
    "class schedule", "membership", "trainer",
  ],
  retail: [
    "shop", "store", "boutique", "merchandise", "product", "buy", "purchase",
    "collection", "inventory", "sale",
  ],
  pet_services: [
    "veterinary", "vet", "grooming", "pet", "dog", "cat", "animal", "boarding",
    "doggy daycare", "kennel", "puppy", "kitten",
  ],
  childcare: [
    "daycare", "preschool", "tutoring", "learning center", "childcare",
    "afterschool", "kindergarten", "nursery", "child", "toddler", "infant",
  ],
  generic: [],
};

// ── Category nouns for query generation ──────────────────────────────────────

export const CATEGORY_NOUNS: Record<CanonicalCategory, string> = {
  restaurant_cafe: "restaurant",
  dentist: "dentist",
  med_spa: "med spa",
  home_services: "home services",
  lawyer: "attorney",
  salon: "salon",
  finance: "accountant",
  fitness: "gym",
  retail: "shop",
  pet_services: "veterinarian",
  childcare: "childcare",
  generic: "business",
};

// ── Category-specific signal labels for UI display ────────────────────────────

export const CATEGORY_SIGNAL_LABELS: Partial<Record<CanonicalCategory, Record<string, string>>> = {
  restaurant_cafe: {
    hasServicePages: "Menu page",
    hasPricing: "Menu / pricing",
    hasHours: "Hours listed",
  },
  dentist: {
    hasServicePages: "Treatment pages",
    hasTrustSignals: "Credentials / certifications",
  },
  home_services: {
    hasServicePages: "Service pages",
    hasTrustSignals: "Licensed & insured",
    hasLocationMention: "Service area stated",
  },
  lawyer: {
    hasServicePages: "Practice area pages",
    hasTrustSignals: "Bar credentials",
  },
};

// ── Category-specific recommendation overrides ────────────────────────────────
// Key = ruleId from scoring.ts. Value overrides the generic recommendation text.

export interface RecTemplate {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}

type RecOverrideMap = Partial<Record<string, RecTemplate>>;

export const CATEGORY_REC_OVERRIDES: Partial<Record<CanonicalCategory, RecOverrideMap>> = {
  restaurant_cafe: {
    service_pages_present: {
      title: "Add a full menu to your website",
      description:
        "A complete menu with prices is the single most important page for a restaurant. AI assistants pull menu data to answer 'what do they serve' and 'how much does it cost' queries. Include sections for appetizers, mains, desserts, and drinks.",
      impact: "high",
      effort: "low",
    },
    pricing_language: {
      title: "Add prices to your menu",
      description:
        "Displaying prices builds trust and helps AI match your restaurant to budget-specific searches. Even approximate ranges work.",
      impact: "high",
      effort: "low",
    },
    hours_present: {
      title: "Add your hours prominently",
      description:
        "Hours are critical for restaurants — customers ask AI assistants 'is [restaurant] open now?' and 'what are their hours?' constantly. Put your hours in the header or hero section.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a FAQ section to your restaurant site",
      description:
        "Common questions like 'Do you take reservations?', 'Is there parking?', 'Do you offer takeout?' are frequently asked to AI assistants. A FAQ page lets AI answer these for you.",
      impact: "medium",
      effort: "low",
    },
  },
  dentist: {
    service_pages_present: {
      title: "Create pages for each dental treatment",
      description:
        "Patients search for specific treatments — 'teeth whitening near me', 'dental implants in [city]'. A dedicated page for each treatment you offer dramatically improves AI discoverability.",
      impact: "high",
      effort: "medium",
    },
    trust_keywords_present: {
      title: "Display your credentials and certifications",
      description:
        "Patients trust credentials. List your dental school, board certifications, specializations, and years of experience. AI assistants use credential language to recommend healthcare providers.",
      impact: "high",
      effort: "low",
    },
    contact_info_present: {
      title: "Make your phone number prominent",
      description:
        "Dental patients almost always call to book. Your phone number should be in the header, footer, and near every call-to-action. Include a 'New patients welcome' statement.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a dental FAQ page",
      description:
        "AI assistants frequently answer dental questions. A FAQ covering insurance, new patient procedures, emergency care, and common treatments positions your practice as the source of truth.",
      impact: "high",
      effort: "low",
    },
  },
  home_services: {
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
  lawyer: {
    service_pages_present: {
      title: "Create a page for each practice area",
      description:
        "Potential clients search by specific legal need — 'divorce attorney in [city]', 'personal injury lawyer near me'. A dedicated page per practice area dramatically improves AI discoverability.",
      impact: "high",
      effort: "medium",
    },
    trust_keywords_present: {
      title: "Display your bar credentials and experience",
      description:
        "List your bar admissions, years of experience, notable case results (if permitted), and any awards or recognitions. AI systems use credential language to recommend legal professionals.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a legal FAQ page",
      description:
        "Questions like 'Do you offer free consultations?', 'What types of cases do you handle?', 'How much do you charge?' are commonly asked to AI assistants. A FAQ page captures this intent.",
      impact: "high",
      effort: "low",
    },
  },
  salon: {
    service_pages_present: {
      title: "Add a services and pricing page",
      description:
        "Salon customers search for specific services with prices — 'balayage near me', 'gel manicure [city]'. A clear services + pricing page is the most important page on a salon site for AI discoverability.",
      impact: "high",
      effort: "low",
    },
    faq_present: {
      title: "Add a salon FAQ",
      description:
        "Common questions like 'Do I need an appointment?', 'How long does a color service take?', 'What products do you use?' are perfect FAQ content for AI to surface.",
      impact: "medium",
      effort: "low",
    },
  },
};

// ── FAQ question templates per category ───────────────────────────────────────

export const CATEGORY_FAQ_QUESTIONS: Record<CanonicalCategory, string[]> = {
  restaurant_cafe: [
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
  salon: [
    "Do I need an appointment or do you accept walk-ins?",
    "What services do you offer?",
    "How long does a typical appointment take?",
    "What products do you use?",
    "Do you offer bridal or special event packages?",
    "What is your cancellation policy?",
    "How much does a haircut cost?",
    "Do you have a loyalty program?",
    "Do you color or treat natural hair?",
    "How far in advance should I book?",
  ],
  finance: [
    "What services do you offer?",
    "Do you work with individuals, businesses, or both?",
    "What are your fees?",
    "Are you a CPA or licensed financial advisor?",
    "What software or tools do you use?",
    "Do you offer a free initial consultation?",
    "How do you communicate with clients?",
    "Do you specialize in any industries?",
    "Can you help with tax planning year-round?",
    "How do I get started?",
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
  retail: [
    "What products do you carry?",
    "Do you offer online shopping or local delivery?",
    "What are your store hours?",
    "Do you offer gift wrapping or gift cards?",
    "What is your return policy?",
    "Do you ship nationally?",
    "Do you carry [specific brand]?",
    "How can I check if an item is in stock?",
    "Do you offer loyalty rewards?",
    "Can I place a custom or special order?",
  ],
  pet_services: [
    "What services do you offer?",
    "Do you require proof of vaccinations?",
    "Do you accept all dog or cat breeds?",
    "What are your hours?",
    "Do you offer boarding or daycare?",
    "How do I schedule an appointment?",
    "What is your cancellation policy?",
    "Do you offer grooming services?",
    "How do you handle pets with anxiety or behavioral issues?",
    "What should I bring for my pet's first visit?",
  ],
  childcare: [
    "What age groups do you serve?",
    "What are your operating hours?",
    "What is your staff-to-child ratio?",
    "Are your staff certified in first aid and CPR?",
    "Do you offer part-time or flexible scheduling?",
    "What is your enrollment process?",
    "What meals or snacks do you provide?",
    "How do you handle sick children?",
    "What curriculum or activities do you follow?",
    "Are you licensed and accredited?",
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
