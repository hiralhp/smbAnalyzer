-- Add comparison_note to report_competitors
-- Populated by the LLM competitor comparator when the user provides their own API key.
ALTER TABLE report_competitors
  ADD COLUMN IF NOT EXISTS comparison_note TEXT;
