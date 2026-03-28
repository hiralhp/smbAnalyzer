-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Business Features
--
-- Adds a business_features jsonb column to website_analyses.
-- Stores the inferred feature flags (has_menu_or_catalog, requires_credentials,
-- primary_conversion, etc.) for each analysis.
--
-- This data becomes the primary guardrail for downstream report generation
-- and will be available for future LLM reasoning.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE website_analyses
  ADD COLUMN IF NOT EXISTS business_features jsonb;

COMMENT ON COLUMN website_analyses.business_features IS
  'Inferred business feature flags: has_menu_or_catalog, has_quote_intent, requires_credentials, primary_conversion, trust_mode, etc. Primary guardrail for report generation.';

-- Index for analytics queries on specific feature values
CREATE INDEX IF NOT EXISTS idx_website_analyses_business_features
  ON website_analyses USING gin (business_features);
