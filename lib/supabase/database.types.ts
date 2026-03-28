// ─────────────────────────────────────────────────────────────────────────────
// Supabase Database Types
// Generated manually for MVP — in production, use `supabase gen types`
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string;
          website_url: string | null;
          category: string | null;
          city: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          website_url?: string | null;
          category?: string | null;
          city?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
      };
      reports: {
        Row: {
          id: string;
          business_id: string;
          status: "pending" | "running" | "complete" | "failed";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          status?: "pending" | "running" | "complete" | "failed";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
      report_inputs: {
        Row: {
          id: string;
          report_id: string;
          business_name: string;
          website_url: string | null;
          category: string | null;
          city: string | null;
          top_services: string[] | null;
          competitor_urls: string[] | null;
          competitor_names: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          business_name: string;
          website_url?: string | null;
          category?: string | null;
          city?: string | null;
          top_services?: string[] | null;
          competitor_urls?: string[] | null;
          competitor_names?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_inputs"]["Insert"]>;
      };
      report_scores: {
        Row: {
          id: string;
          report_id: string;
          overall_score: number;
          content_clarity_score: number;
          service_specificity_score: number;
          local_relevance_score: number;
          trust_signal_score: number;
          faq_discoverability_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          overall_score: number;
          content_clarity_score: number;
          service_specificity_score: number;
          local_relevance_score: number;
          trust_signal_score: number;
          faq_discoverability_score: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_scores"]["Insert"]>;
      };
      report_findings: {
        Row: {
          id: string;
          report_id: string;
          type: "strength" | "gap" | "signal";
          category: string;
          label: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          type: "strength" | "gap" | "signal";
          category: string;
          label: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_findings"]["Insert"]>;
      };
      report_recommendations: {
        Row: {
          id: string;
          report_id: string;
          priority: number;
          title: string;
          description: string;
          impact: "high" | "medium" | "low" | null;
          effort: "high" | "medium" | "low" | null;
          content_draft: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          priority: number;
          title: string;
          description: string;
          impact?: "high" | "medium" | "low" | null;
          effort?: "high" | "medium" | "low" | null;
          content_draft?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_recommendations"]["Insert"]>;
      };
      report_llm_outputs: {
        Row: {
          id: string;
          report_id: string;
          positioning_summary: string | null;
          top_strengths: string[] | null;
          top_opportunities: string[] | null;
          content_asset_type: string | null;
          content_asset_draft: string | null;
          raw_response: Json | null;
          model_used: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          positioning_summary?: string | null;
          top_strengths?: string[] | null;
          top_opportunities?: string[] | null;
          content_asset_type?: string | null;
          content_asset_draft?: string | null;
          raw_response?: Json | null;
          model_used?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_llm_outputs"]["Insert"]>;
      };
      website_analyses: {
        Row: {
          id: string;
          report_id: string;
          url: string;
          is_competitor: boolean;
          competitor_name: string | null;
          title: string | null;
          meta_description: string | null;
          h1_headings: string[] | null;
          h2_headings: string[] | null;
          body_text_sample: string | null;
          has_service_pages: boolean | null;
          has_faq: boolean | null;
          has_location_mention: boolean | null;
          has_trust_signals: boolean | null;
          has_contact_info: boolean | null;
          has_hours: boolean | null;
          has_pricing: boolean | null;
          has_testimonials: boolean | null;
          internal_links: string[] | null;
          fetch_error: string | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          url: string;
          is_competitor?: boolean;
          competitor_name?: string | null;
          title?: string | null;
          meta_description?: string | null;
          h1_headings?: string[] | null;
          h2_headings?: string[] | null;
          body_text_sample?: string | null;
          has_service_pages?: boolean | null;
          has_faq?: boolean | null;
          has_location_mention?: boolean | null;
          has_trust_signals?: boolean | null;
          has_contact_info?: boolean | null;
          has_hours?: boolean | null;
          has_pricing?: boolean | null;
          has_testimonials?: boolean | null;
          internal_links?: string[] | null;
          fetch_error?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["website_analyses"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
