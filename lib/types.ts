// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the AI Visibility Report application
// ─────────────────────────────────────────────────────────────────────────────

// ── Category classification ───────────────────────────────────────────────────
// Re-exported here so consumers only need to import from @/lib/types

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

export interface CategoryClassification {
  canonicalCategory: CanonicalCategory;
  confidence: FindingConfidence;
  evidence: string;
}

// ── Location extraction ───────────────────────────────────────────────────────

export interface ExtractedLocation {
  city: string;
  source: "user_input" | "title" | "heading" | "meta" | "body";
  confidence: FindingConfidence;
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
}

// ── Website analysis ──────────────────────────────────────────────────────────

export interface WebsiteAnalysis {
  url: string;
  isCompetitor: boolean;
  competitorName?: string;

  // Extracted content
  title?: string;
  metaDescription?: string;
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
  coverage: "strong" | "partial" | "weak";
  missingTerms: string[];
  matchedTerms: string[];
  titleMatch: boolean;
  headingMatch: boolean;
  bodyMatch: boolean;
  servicePageMatch: boolean;
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
  };
  websiteSignals?: WebsiteSignalSummary;
  competitorSignals?: CompetitorSignalSummary[];
  queryCoverage?: QueryCoverageRow[];
  faqs?: FaqRow[];
  inferredCategory?: string;
  inferredCity?: string;
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
