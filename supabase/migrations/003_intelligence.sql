-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Intelligence Layer
--
-- Adds tables for:
--   - report_inference: what the system determined about the business/input
--   - report_faqs: deterministic FAQ questions per report (LLM can add answers later)
--
-- All additive — no existing tables or columns are modified.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── report_inference ─────────────────────────────────────────────────────────
-- CANONICAL: system-determined fields (vs report_inputs which stores raw user input)
-- Tracks how input was provided and what the system inferred from website + form data.
create table if not exists report_inference (
  id                    uuid primary key default uuid_generate_v4(),
  report_id             uuid not null unique references reports(id) on delete cascade,
  input_mode            text not null check (input_mode in ('url', 'name_city')),
  inferred_name         text,           -- name extracted from page title (if inferred)
  inferred_city         text,           -- city extracted from website (if not user-provided)
  city_source           text,           -- where city came from: user_input|title|heading|meta|body
  canonical_category    text,           -- internal category enum value
  category_confidence   text check (category_confidence in ('high', 'medium', 'low')),
  category_evidence     text,           -- e.g. "Keyword 'dentist' found in title"
  inferred_services     text[],         -- services extracted from website content
  created_at            timestamptz not null default now()
);

-- ── report_faqs ───────────────────────────────────────────────────────────────
-- ANALYTICAL ASSET + USER DELIVERABLE
-- Deterministic FAQ questions per report. Answers nullable now; LLM adds later.
-- source='deterministic' rows are immutable — LLM adds new source='llm' rows.
create table if not exists report_faqs (
  id          uuid primary key default uuid_generate_v4(),
  report_id   uuid not null references reports(id) on delete cascade,
  question    text not null,
  answer      text,             -- null for deterministic rows; LLM populates later
  category    text not null,    -- canonical category used to generate this question
  source      text not null check (source in ('deterministic', 'llm')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_report_inference_report_id on report_inference(report_id);
create index if not exists idx_report_faqs_report_id      on report_faqs(report_id);
create index if not exists idx_report_faqs_source         on report_faqs(source);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table report_inference enable row level security;
alter table report_faqs      enable row level security;

create policy "allow_all_report_inference" on report_inference for all using (true) with check (true);
create policy "allow_all_report_faqs"      on report_faqs      for all using (true) with check (true);
