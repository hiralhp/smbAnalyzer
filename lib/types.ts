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
