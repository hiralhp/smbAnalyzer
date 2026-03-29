-- Migration 008: Visibility Simulation
-- Adds the report_visibility_simulation table (per-query rows) and the
-- visibility_summary JSONB column on report_llm_outputs.

-- ── New table: per-query visibility simulation rows ────────────────────────
create table if not exists report_visibility_simulation (
  id           uuid        primary key default gen_random_uuid(),
  report_id    uuid        not null references reports(id) on delete cascade,
  query        text        not null,
  mentioned_companies   jsonb  not null default '[]'::jsonb,
  analyzed_business_appears  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_report_visibility_sim_report_id
  on report_visibility_simulation(report_id);

-- RLS
alter table report_visibility_simulation enable row level security;

drop policy if exists "Public read" on report_visibility_simulation;
drop policy if exists "Service insert" on report_visibility_simulation;

create policy "Public read"
  on report_visibility_simulation for select
  using (true);

create policy "Service insert"
  on report_visibility_simulation for insert
  with check (true);

-- ── New column: aggregate visibility summary on LLM outputs row ────────────
alter table report_llm_outputs
  add column if not exists visibility_summary jsonb null;
