-- Migration 012: Visibility simulation v2 columns
-- Adds per-row fields for the richer simulation engine:
--   simulated_response  — the actual prose AI assistant response for this query
--   appearance_type     — how prominently the target appeared (primary/secondary/absent)
--   query_coverage_quality — richness of the target's mention (strong/partial/weak)

ALTER TABLE report_visibility_simulation
  ADD COLUMN IF NOT EXISTS simulated_response TEXT,
  ADD COLUMN IF NOT EXISTS appearance_type TEXT,
  ADD COLUMN IF NOT EXISTS query_coverage_quality TEXT;
