-- ─────────────────────────────────────────────────────────────────────────────
-- 005_archetype_classification
--
-- Adds two-level archetype classification columns to report_inference.
-- archetype     = broad family (always set)
-- subtype       = specific type (only when confidence is high)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE report_inference
  ADD COLUMN IF NOT EXISTS archetype             text,
  ADD COLUMN IF NOT EXISTS archetype_confidence  numeric,
  ADD COLUMN IF NOT EXISTS subtype               text,
  ADD COLUMN IF NOT EXISTS subtype_confidence    numeric,
  ADD COLUMN IF NOT EXISTS classification_evidence jsonb;
