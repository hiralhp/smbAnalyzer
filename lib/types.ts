// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the AI Visibility Report application
// ─────────────────────────────────────────────────────────────────────────────

// ── Website pattern (routing key for FAQ + query coverage) ───────────────────

export type WebsitePattern =
  | "software_product"
  | "local_physical_business"
  | "appointment_service"
  | "hospitality_booking"
  | "catalog_ecommerce"
  | "content_brand"
  | "generic_unknown";

// ── Archetype classification ──────────────────────────────────────────────────

export type BusinessArchetype =
  | "food_drink"
  | "local_service"
  | "health_beauty"
  | "retail"
  | "hospitality"
  | "professional_service"
  | "home_service"
  | "fitness"
  | "automotive"
  | "education"
  | "events"
  | "generic_unknown";

export interface ClassificationEvidence {
  keywordHits: string[];
  headingHits: string[];
  structuredDataHits: string[];
  navHits: string[];
  serviceTermHits: string[];
  commerceHits: string[];
  bookingHits: string[];
  menuHits: string[];
  locationHits: string[];
  trustHits: string[];
}

export interface ArchetypeClassification {
  archetype: BusinessArchetype;
  archetypeConfidence: number;  // 0–1
  subtype: string | null;
  subtypeConfidence: number;    // 0–1 (0 if no subtype)
  evidence: ClassificationEvidence;
}

// ── Location extraction ───────────────────────────────────────────────────────

export interface ExtractedLocation {
  city: string;
  source: "user_input" | "schema" | "title" | "heading" | "meta" | "body";
  confidence: FindingConfidence;
}

// ── Groq classification (fast category validation / inference layer) ──────────

export interface GroqClassificationResult {
  /** Specific business category: "hotel", "restaurant", "dentist", "plumber", etc. */
  category: string;
  /** Canonical sector matching BusinessProfile.sector */
  sector: string;
  /** Specific subtype — only populated when confidence is "high" */
  subtype: string | null;
  confidence: "high" | "medium" | "low";
  /** One-sentence reasoning for the classification */
  reasoning: string;
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export interface FaqRow {
  question: string;
  answer?: string;
  category: string;
  source: "deterministic" | "llm";
  sortOrder?: number;
}

// ── Form input ────────────────────────────────────────────────────────────────

export interface ReportFormInput {
  businessName?: string;
  websiteUrl?: string;   // optional when businessName + city are provided
  category?: string;
  city?: string;
  topServices?: string[];
  competitorUrls?: string[];
  competitorNames?: string[];
  /** User-supplied Groq API key — used in place of the server default when provided */
  userApiKey?: string;
}

// ── Website analysis ──────────────────────────────────────────────────────────

export interface WebsiteAnalysis {
  url: string;
  isCompetitor: boolean;
  competitorName?: string;

  // Extracted content
  title?: string;
  metaDescription?: string;
  ogSiteName?: string;
  schemaOrgName?: string;
  /** Structured address from schema.org JSON-LD or microdata (highest-confidence location source) */
  schemaOrgAddress?: {
    street?: string;
    city?: string;
    state?: string;  // may be full name ("Tennessee") — normalize to abbreviation downstream
    zip?: string;
  };
  /** <meta name="city"> — common on hotel/local-business sites */
  metaCity?: string;
  /** <meta name="state"> — may be full state name */
  metaState?: string;
  h1Headings: string[];
  h2Headings: string[];
  bodyTextSample?: string;

  // Signal booleans
  hasServicePages: boolean;
  hasFaq: boolean;
  hasLocationMention: boolean;
  hasTrustSignals: boolean;
  hasContactInfo: boolean;
  hasHours: boolean;
  hasPricing: boolean;
  hasTestimonials: boolean;

  // Pattern-routing signals (detected from full HTML before script removal)
  mentionsIntegrations?: boolean;   // "integrates with", "connects to", API language
  mentionsAppointments?: boolean;   // "book an appointment", "schedule a visit"
  mentionsRoomsOrStays?: boolean;   // "room", "suite", "check-in", "nightly"
  mentionsContentOrBlog?: boolean;  // "blog", "newsletter", "podcast", "subscribe"

  // Links
  internalLinks: string[];

  // Error state
  fetchError?: string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  overallScore: number;            // 0–100
  contentClarityScore: number;
  serviceSpecificityScore: number;
  localRelevanceScore: number;
  trustSignalScore: number;
  faqDiscoverabilityScore: number;
}

/** Deterministic text explanation for each score bucket. Stored as jsonb. */
export interface ScoreExplanation {
  overall: string;
  contentClarity: string;
  serviceSpecificity: string;
  localRelevance: string;
  trustSignals: string;
  faqDiscoverability: string;
}

export type FindingType = "strength" | "gap" | "signal";
export type FindingCategory = "content" | "local" | "trust" | "faq" | "service" | "general";
export type FindingConfidence = "high" | "medium" | "low";

export interface Finding {
  type: FindingType;
  category: FindingCategory;
  label: string;
  detail?: string;
  // Evidence metadata (002_data_enrichment)
  confidence?: FindingConfidence;
  evidence?: string;      // specific text describing what was/wasn't found
  sourceSignal?: string;  // e.g. "contact_info", "has_faq"
  ruleId?: string;        // e.g. "contact_info_present", "city_in_title"
}

// ── Query coverage ────────────────────────────────────────────────────────────
// ANALYTICAL ASSET: per-query coverage records stored in report_query_coverage.

export interface QueryCoverageRow {
  query: string;
  queryType?: string;
  coverage: "strong" | "partial" | "weak" | "aspirational";
  missingTerms: string[];
  matchedTerms: string[];
  titleMatch: boolean;
  headingMatch: boolean;
  bodyMatch: boolean;
  servicePageMatch: boolean;
  /** Explanation shown when a query was downgraded from Strong to Partial */
  evidenceNote?: string;
}

// ── Report signals ────────────────────────────────────────────────────────────
// ANALYTICAL ASSET: normalized signal rows in report_signals.

export interface ReportSignal {
  signalName: string;
  signalValue: string;
  signalType: string;
  confidence?: FindingConfidence;
  evidence?: string;
}

// ── Competitor record ─────────────────────────────────────────────────────────
// CANONICAL: report_competitors is the source of truth, replacing arrays.

export interface CompetitorRecord {
  id?: string;
  name: string;
  websiteUrl?: string;
  source: "user_provided" | "auto_discovered" | "mock";
  discoveryScore?: number;
  /** LLM-generated one-sentence comparison vs. analyzed business (userApiKey only) */
  comparisonNote?: string;
}

// ── Business features (inferred, feature-led layer) ──────────────────────────
// Inferred deterministically from WebsiteAnalysis. Primary driver of downstream
// logic — recommendations, FAQ, query generation.
// Category/subtype are secondary hints; features are the guardrails.

export type PrimaryConversion =
  | "visit"           // come in person (restaurant, retail, salon)
  | "call"            // call to inquire (home services, lawyers)
  | "book"            // book appointment (salon, dentist, fitness)
  | "reserve"         // make a reservation (restaurant, hotel)
  | "order"           // place an order (restaurant delivery, retail)
  | "request_quote"   // get a quote/estimate (home services, movers)
  | "submit_lead"     // fill out a form (real estate, finance)
  | "buy_now"         // immediate purchase (e-commerce, retail)
  | "subscribe"       // membership (gym, subscription)
  | "unknown";

export type TrustMode =
  | "consumer_social_proof"  // reviews/testimonials primary (restaurant, salon)
  | "credentialed"           // credentials primary (dentist, lawyer, med_spa)
  | "regulated"              // license legally required (contractor, financial)
  | "low_trust_barrier"      // low stakes, simple trust (cafe, retail)
  | "mixed";                 // both credentials + social proof

export interface BusinessFeatures {
  // Content/offering signals
  hasMenuOrCatalog: boolean;         // menu/order/delivery/takeout/product catalog
  hasServicePages: boolean;          // dedicated service/treatment/solution pages
  hasLocalIntent: boolean;           // city/location/address/map signals
  hasHoursExpectation: boolean;      // hours/schedule/open/close info expected
  hasContactExpectation: boolean;    // phone/email/contact form expected
  hasBookingOrReservations: boolean; // book/reserve/appointment/schedule
  hasQuoteIntent: boolean;           // quote/estimate/free estimate language
  hasDelivery: boolean;              // delivery/takeout/online ordering
  // Trust signals
  requiresCredentials: boolean;      // licensed/insured/certified/bonded/accredited
  // Behavioral inference
  primaryConversion: PrimaryConversion;
  trustMode: TrustMode;
  // For query generation — specific terms detected from content
  detectedBusinessTerms: string[];   // e.g. ["coffee", "espresso", "latte"]
  // For debug output and future LLM handoff
  featureEvidence: Record<string, string>;
}

// ── Grok enhancement layer ────────────────────────────────────────────────────
// Input: normalized deterministic findings (never raw HTML)
// Output: narrative/presentation enhancements (never new facts)

export interface GrokEnhancementInput {
  business: {
    name: string;
    category: string | null;
    subtype: string | null;
    location: string;
  };
  scores: {
    overall: number;
    contentClarity: number;
    serviceSpecificity: number;
    localRelevance: number;
    trustSignals: number;
    faqDiscoverability: number;
  };
  strengths: Array<{ label: string; detail?: string }>;
  gaps: Array<{ label: string; detail?: string }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    effort: "high" | "medium" | "low";
  }>;
  faq_questions: string[];
}

/** Grok enhancement outputs — optional overlay on the deterministic report. */
export interface GrokEnhancement {
  /** Polished 2-4 sentence positioning summary grounded in detected signals */
  enhanced_positioning_summary?: string;
  /** Improved recommendation explanations keyed by exact recommendation title */
  enhanced_recommendation_explanations?: Record<string, string>;
  /** Draft FAQ answers keyed by question */
  enhanced_faq_answers?: Array<{ question: string; answer: string }>;
  /** Optional quick-wins vs bigger-lifts bucketing (titles only, no reordering) */
  optional_quick_wins_bucket?: {
    quick_wins: string[];
    bigger_lifts: string[];
  };
}

// ── LLM outputs ───────────────────────────────────────────────────────────────

export type ContentAssetType =
  | "faq"
  | "service_page"
  | "homepage_copy"
  | "review_request"
  | "none";

export interface LlmReportSummary {
  positioningSummary: string;
  topStrengths: string[];
  topOpportunities: string[];
  contentAssetType: ContentAssetType;
  contentAssetDraft: string;
}

// ── Business profile (multi-dimensional, replaces single-category system) ─────

export type BusinessModel =
  | "venue_experience"       // restaurant, bar, coffee shop — menu/catalog primary
  | "accommodation"          // hotel, B&B, vacation rental — rooms/rates primary
  | "transactional_service"  // plumber, electrician, mover — service pages primary
  | "appointment_based"      // salon, dentist, gym — services/treatments page primary
  | "retail_product"         // retail store, e-commerce — product catalog primary
  | "professional_advisory"  // lawyer, accountant, consultant — services + credentials
  | "unknown";               // weak signal / fallback

export interface BusinessProfile {
  sector: string | null;        // food_and_beverage | home_services | ... | null
  subtype: string | null;       // features.detectedBusinessTerms[0] or null
  business_model: BusinessModel; // see BusinessModel type above
  offering_model: string[];     // menu_based | service_area_business | appointment_based | ...
  customer_actions: string[];   // call | visit | book | order | request_quote | ...
  key_entities: string[];       // services | menu_items | rooms | pricing | ...
  attributes: string[];         // local | licensed | emergency_service | ...
  confidence: "high" | "medium" | "low";
  matched_rules: string[];      // debug: why was this sector chosen?
  website_pattern: WebsitePattern; // set after classification, never overridden
}

// ── Analysis pipeline input/output ───────────────────────────────────────────

export interface AnalysisPipelineInput {
  reportId: string;
  formInput: ReportFormInput;
}

export interface AnalysisPipelineResult {
  websiteAnalysis: WebsiteAnalysis;
  competitorAnalyses: WebsiteAnalysis[];
  scores: ScoreBreakdown;
  findings: Finding[];
  llmSummary: LlmReportSummary;
  archetypeClassification?: ArchetypeClassification;
  businessProfile?: BusinessProfile;
  /** True when any LLM call hit the shared key's rate/quota limit */
  quotaLimitHit?: boolean;
}

// ── Report (full, assembled for UI) ──────────────────────────────────────────

export type ReportStatus = "pending" | "running" | "complete" | "failed";

export interface Report {
  id: string;
  status: ReportStatus;
  errorMessage?: string;
  createdAt: string;
  business: {
    name: string;
    websiteUrl?: string;
    category?: string;
    city?: string;
  };
  scores?: ScoreBreakdown;
  scoreExplanation?: ScoreExplanation;
  findings?: Finding[];
  recommendations?: Recommendation[];
  llmOutput?: {
    positioningSummary?: string;
    topStrengths?: string[];
    topOpportunities?: string[];
    contentAssetType?: ContentAssetType;
    contentAssetDraft?: string;
    modelUsed?: string;
    /** Grok enhancement overlay — undefined when Grok was skipped or failed */
    grokEnhancement?: GrokEnhancement;
  };
  websiteSignals?: WebsiteSignalSummary;
  competitorSignals?: CompetitorSignalSummary[];
  queryCoverage?: QueryCoverageRow[];
  faqs?: FaqRow[];
  /** Number of pages crawled during analysis (homepage + sub-pages) */
  pagesScanned?: number;
  inferredCategory?: string;
  inferredCity?: string;
  visibilitySimulation?: VisibilitySimulationResult;
  llmCompetitorAnalysis?: LlmCompetitorAnalysisRow[];
  /** Discovered competitors from report_competitors — used as fallback when simulation rows are absent */
  discoveredCompetitors?: CompetitorRecord[];
}

export interface Recommendation {
  priority: number;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  contentDraft?: string;
}

export interface WebsiteSignalSummary {
  url?: string;
  title?: string;
  metaDescription?: string;
  h1Headings: string[];
  h2Headings: string[];
  hasServicePages: boolean;
  hasFaq: boolean;
  hasLocationMention: boolean;
  hasTrustSignals: boolean;
  hasContactInfo: boolean;
  hasHours: boolean;
  hasPricing: boolean;
  hasTestimonials: boolean;
  fetchError?: string;
}

export interface CompetitorSignalSummary {
  name: string;
  url: string;
  fetchError?: string;
  hasServicePages: boolean;
  hasFaq: boolean;
  hasLocationMention: boolean;
  hasTrustSignals: boolean;
  hasContactInfo: boolean;
  hasHours: boolean;
  hasPricing: boolean;
  hasTestimonials: boolean;
}

// ── LLM signal extraction ─────────────────────────────────────────────────────

/** 10 boolean signals extracted by LLM from scraped content. Supplements scraper signals. */
export interface LlmExtractedSignals {
  has_pricing: boolean;
  mentions_integrations: boolean;
  mentions_booking: boolean;
  mentions_physical_location: boolean;
  mentions_menu: boolean;
  mentions_appointments: boolean;
  mentions_rooms_or_stays: boolean;
  mentions_products_for_sale: boolean;
  mentions_content_or_blog: boolean;
  mentions_contact_info: boolean;
}

// ── LLM competitor discovery ──────────────────────────────────────────────────

export interface LlmDiscoveredCompetitor {
  name: string;
  domain: string;
}

// ── LLM visibility simulation ─────────────────────────────────────────────────

export interface VisibilityMention {
  company: string;
  count: number;
  queries: string[];
  /** Highest confidence seen across queries for this company */
  topConfidence: "high" | "medium" | "low";
}

export interface VisibilitySimulationResult {
  analyzedBusinessName: string;
  insight: string;
  analyzedBusinessMentions: number;
  analyzedBusinessAppears: boolean;
  topMentions: VisibilityMention[];
  queriesSimulated: number;
  /** Per-query explanations for queries where the business didn't appear (userApiKey only) */
  gapExplanations?: Record<string, string>;
}

export interface VisibilitySimulationRow {
  query: string;
  mentionedCompanies: Array<{ name: string; reason: string; confidence: "high" | "medium" | "low" }>;
  analyzedBusinessAppears: boolean;
  /** Simulated natural-language AI assistant response for this query */
  simulatedResponse?: string;
  /** How prominently the target business appeared in the simulated response */
  appearanceType?: "primary" | "secondary" | "absent";
  /** Richness of the target's mention — based on detail level, not keywords */
  queryCoverageQuality?: "strong" | "partial" | "weak";
}

// ── LLM competitor analysis (per-query, for UI rendering) ─────────────────────
// Populated from report_visibility_simulation rows in the API route.
// Structured for direct rendering — each row is one simulated query.

export interface LlmCompetitorAnalysisRow {
  query: string;
  competitors: Array<{ name: string; reason: string; confidence: "high" | "medium" | "low" }>;
  targetBusinessLikelyToAppear: boolean;
  /** Simulated natural-language AI assistant response for this query */
  simulatedResponse?: string;
  /** How prominently the target business appeared in the simulated response */
  appearanceType?: "primary" | "secondary" | "absent";
  /** Richness of the target's mention — based on detail level, not keywords */
  queryCoverageQuality?: "strong" | "partial" | "weak";
}

// ── LLM provider abstraction ──────────────────────────────────────────────────

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCallOptions {
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Force JSON output if provider supports it */
  jsonMode?: boolean;
}

export interface LlmProvider {
  complete(options: LlmCallOptions): Promise<string>;
}
