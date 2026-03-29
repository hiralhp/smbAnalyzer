-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Add business_profile jsonb column to report_inference
--
-- Stores the multi-dimensional BusinessProfile produced by
-- business-profile-classifier.ts alongside the legacy archetype fields.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE report_inference
  ADD COLUMN IF NOT EXISTS business_profile jsonb;
