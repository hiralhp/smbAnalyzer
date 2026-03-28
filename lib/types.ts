// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the AI Visibility Report application
// ─────────────────────────────────────────────────────────────────────────────

// ── Form input ────────────────────────────────────────────────────────────────

export interface ReportFormInput {
  businessName: string;
  websiteUrl: string;
  category: string;
  city: string;
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

export type FindingType = "strength" | "gap" | "signal";
export type FindingCategory = "content" | "local" | "trust" | "faq" | "service" | "general";

export interface Finding {
  type: FindingType;
  category: FindingCategory;
  label: string;
  detail?: string;
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
