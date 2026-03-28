-- ─────────────────────────────────────────────────────────────────────────────
-- AI Visibility Report — Initial Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- businesses
-- Represents a business entity (can appear across multiple reports)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists businesses (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  website_url   text,
  category      text,
  city          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- reports
-- Top-level report record. Status drives the async processing lifecycle.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reports (
  id            uuid primary key default uuid_generate_v4(),
  business_id   uuid not null references businesses(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'running', 'complete', 'failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- report_inputs
-- Raw user-submitted form data associated with a report
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists report_inputs (
  id                  uuid primary key default uuid_generate_v4(),
  report_id           uuid not null references reports(id) on delete cascade,
  business_name       text not null,
  website_url         text,
  category            text,
  city                text,
  top_services        text[],
  competitor_urls     text[],
  competitor_names    text[],
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- report_scores
-- Numeric scores produced by the deterministic scoring engine
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists report_scores (
  id                          uuid primary key default uuid_generate_v4(),
  report_id                   uuid not null unique references reports(id) on delete cascade,
  overall_score               integer not null check (overall_score between 0 and 100),
  content_clarity_score       integer not null check (content_clarity_score between 0 and 100),
  service_specificity_score   integer not null check (service_specificity_score between 0 and 100),
  local_relevance_score       integer not null check (local_relevance_score between 0 and 100),
  trust_signal_score          integer not null check (trust_signal_score between 0 and 100),
  faq_discoverability_score   integer not null check (faq_discoverability_score between 0 and 100),
  created_at                  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- report_findings
-- Individual detected signals from the website scrape + analysis
-- type: 'strength' | 'gap' | 'signal'
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists report_findings (
  id            uuid primary key default uuid_generate_v4(),
  report_id     uuid not null references reports(id) on delete cascade,
  type          text not null check (type in ('strength', 'gap', 'signal')),
  category      text not null,  -- e.g. 'content', 'local', 'trust', 'faq'
  label         text not null,
  detail        text,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- report_recommendations
-- Prioritized action items, some with LLM-generated content drafts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists report_recommendations (
  id              uuid primary key default uuid_generate_v4(),
  report_id       uuid not null references reports(id) on delete cascade,
  priority        integer not null default 1,  -- 1 = highest priority
  title           text not null,
  description     text not null,
  impact          text check (impact in ('high', 'medium', 'low')),
  effort          text check (effort in ('high', 'medium', 'low')),
  content_draft   text,  -- optional LLM-generated content asset
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- report_llm_outputs
-- Stores structured LLM-generated summary text for the report
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists report_llm_outputs (
  id                      uuid primary key default uuid_generate_v4(),
  report_id               uuid not null unique references reports(id) on delete cascade,
  positioning_summary     text,
  top_strengths           text[],
  top_opportunities       text[],
  content_asset_type      text,   -- e.g. 'faq', 'service_page', 'homepage_copy'
  content_asset_draft     text,
  raw_response            jsonb,  -- full LLM JSON for debugging
  model_used              text,
  created_at              timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- website_analyses
-- Cached raw scrape results so we don't re-fetch on re-runs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists website_analyses (
  id                    uuid primary key default uuid_generate_v4(),
  report_id             uuid not null references reports(id) on delete cascade,
  url                   text not null,
  is_competitor         boolean not null default false,
  competitor_name       text,
  title                 text,
  meta_description      text,
  h1_headings           text[],
  h2_headings           text[],
  body_text_sample      text,
  has_service_pages     boolean default false,
  has_faq               boolean default false,
  has_location_mention  boolean default false,
  has_trust_signals     boolean default false,
  has_contact_info      boolean default false,
  has_hours             boolean default false,
  has_pricing           boolean default false,
  has_testimonials      boolean default false,
  internal_links        text[],
  fetch_error           text,
  fetched_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_reports_business_id on reports(business_id);
create index if not exists idx_reports_status on reports(status);
create index if not exists idx_report_findings_report_id on report_findings(report_id);
create index if not exists idx_report_recommendations_report_id on report_recommendations(report_id);
create index if not exists idx_website_analyses_report_id on website_analyses(report_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_businesses_updated_at
  before update on businesses
  for each row execute procedure update_updated_at_column();

create trigger set_reports_updated_at
  before update on reports
  for each row execute procedure update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) — open for MVP (no auth), restrict later
-- ─────────────────────────────────────────────────────────────────────────────
alter table businesses enable row level security;
alter table reports enable row level security;
alter table report_inputs enable row level security;
alter table report_scores enable row level security;
alter table report_findings enable row level security;
alter table report_recommendations enable row level security;
alter table report_llm_outputs enable row level security;
alter table website_analyses enable row level security;

-- Allow all operations for MVP (no auth) — tighten in production
create policy "allow_all_businesses" on businesses for all using (true) with check (true);
create policy "allow_all_reports" on reports for all using (true) with check (true);
create policy "allow_all_report_inputs" on report_inputs for all using (true) with check (true);
create policy "allow_all_report_scores" on report_scores for all using (true) with check (true);
create policy "allow_all_report_findings" on report_findings for all using (true) with check (true);
create policy "allow_all_report_recommendations" on report_recommendations for all using (true) with check (true);
create policy "allow_all_report_llm_outputs" on report_llm_outputs for all using (true) with check (true);
create policy "allow_all_website_analyses" on website_analyses for all using (true) with check (true);
