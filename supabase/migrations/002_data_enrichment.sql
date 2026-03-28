-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Data Enrichment
--
-- Purpose: Extend the schema so reports accumulate structured, queryable data
-- useful for benchmarking, analytics, and scoring engine iteration.
--
-- This migration is additive only — existing tables and columns are preserved.
-- New columns default to NULL so existing rows remain valid.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend report_findings with evidence metadata ─────────────────────────
-- ANALYTICAL ASSET: enables filtering findings by confidence, signal type, rule.
alter table report_findings
  add column if not exists confidence   text check (confidence in ('high', 'medium', 'low')),
  add column if not exists evidence     text,       -- e.g. "No phone number or email found on homepage"
  add column if not exists source_signal text,      -- e.g. "contact_info", "has_faq"
  add column if not exists source_url   text,       -- URL of page where signal was checked (nullable)
  add column if not exists rule_id      text;       -- e.g. "contact_info_present", "city_in_title"

-- ── 2. Extend report_scores with structured explanation ──────────────────────
-- ANALYTICAL ASSET: human-readable + machine-readable explanation per bucket.
alter table report_scores
  add column if not exists explanation jsonb;
-- Shape: { overall, content_clarity, service_specificity, local_relevance, trust_signals, faq_discoverability }

-- ── 3. Extend website_analyses with enriched signal metadata ─────────────────
-- ANALYTICAL ASSET: enables cross-report keyword frequency analysis.
alter table website_analyses
  add column if not exists detected_location_terms text[],  -- location words found on page
  add column if not exists detected_service_terms  text[],  -- service/product keywords found
  add column if not exists keyword_counts          jsonb,   -- { keyword: count } map
  add column if not exists scanned_page_type       text,    -- 'homepage' | 'service_page' | 'faq' | 'contact' | 'competitor_homepage'
  add column if not exists evidence_snapshot       jsonb,   -- compact scoring evidence used at analysis time
  add column if not exists competitor_id           uuid;    -- FK to report_competitors (set below)

-- ── 4. report_competitors — canonical competitor list per report ──────────────
-- CANONICAL: replaces competitor_urls/competitor_names arrays as source of truth.
-- Arrays in report_inputs kept for backward compatibility only.
create table if not exists report_competitors (
  id              uuid primary key default uuid_generate_v4(),
  report_id       uuid not null references reports(id) on delete cascade,
  name            text not null,
  website_url     text,
  source          text check (source in ('user_provided', 'auto_discovered', 'mock')),
  discovery_score numeric,  -- reserved for future auto-discovery scoring
  created_at      timestamptz not null default now()
);

-- Add FK from website_analyses.competitor_id → report_competitors.id
-- Only add constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_website_analyses_competitor'
      and table_name = 'website_analyses'
  ) then
    alter table website_analyses
      add constraint fk_website_analyses_competitor
        foreign key (competitor_id) references report_competitors(id) on delete set null;
  end if;
end $$;

-- ── 5. report_query_coverage — per-query AI discoverability coverage ──────────
-- ANALYTICAL ASSET: queryable record of which search intents a site covers.
create table if not exists report_query_coverage (
  id                  uuid primary key default uuid_generate_v4(),
  report_id           uuid not null references reports(id) on delete cascade,
  query               text not null,       -- e.g. "best HVAC in Denver"
  query_type          text,                -- e.g. "brand_local", "service_local", "service_generic"
  coverage            text check (coverage in ('strong', 'partial', 'weak')),
  missing_terms       text[],              -- terms from query not found in page content
  matched_terms       text[],              -- terms from query found in page content
  title_match         boolean default false,
  heading_match       boolean default false,
  body_match          boolean default false,
  service_page_match  boolean default false,
  created_at          timestamptz not null default now()
);

-- ── 6. report_signals — normalized signal source of truth ────────────────────
-- ANALYTICAL ASSET: structured, cross-report queryable signal store.
-- Findings and recommendations can be regenerated from these signals.
create table if not exists report_signals (
  id              uuid primary key default uuid_generate_v4(),
  report_id       uuid not null references reports(id) on delete cascade,
  signal_name     text not null,   -- e.g. "has_faq", "location_in_title"
  signal_value    text not null,   -- e.g. "true", "false", "Denver"
  signal_type     text not null,   -- e.g. "boolean", "text", "count"
  confidence      text check (confidence in ('high', 'medium', 'low')),
  evidence        text,            -- human-readable evidence string
  source_url      text,
  created_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_report_competitors_report_id   on report_competitors(report_id);
create index if not exists idx_report_query_coverage_report_id on report_query_coverage(report_id);
create index if not exists idx_report_signals_report_id       on report_signals(report_id);
create index if not exists idx_report_signals_name            on report_signals(signal_name);
create index if not exists idx_report_findings_rule_id        on report_findings(rule_id);
create index if not exists idx_report_findings_source_signal  on report_findings(source_signal);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table report_competitors    enable row level security;
alter table report_query_coverage enable row level security;
alter table report_signals        enable row level security;

create policy "allow_all_report_competitors"    on report_competitors    for all using (true) with check (true);
create policy "allow_all_report_query_coverage" on report_query_coverage for all using (true) with check (true);
create policy "allow_all_report_signals"        on report_signals        for all using (true) with check (true);
