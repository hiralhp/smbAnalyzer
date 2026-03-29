-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007: Grok enhancement storage
--
-- Adds storage for Grok-generated enhancements in report_llm_outputs.
-- The grok_enhancement column stores the full GrokEnhancement JSON object.
-- FAQ answers are already stored in report_faqs.answer (column exists from 001).
-- Recommendation descriptions are updated in place before the insert.
-- ─────────────────────────────────────────────────────────────────────────────

-- Store full Grok enhancement object for reference and future use
ALTER TABLE report_llm_outputs
  ADD COLUMN IF NOT EXISTS grok_enhancement JSONB;

-- Store the optional quick-wins / bigger-lifts bucketing separately for easy querying
ALTER TABLE report_llm_outputs
  ADD COLUMN IF NOT EXISTS quick_wins_bucket JSONB;
