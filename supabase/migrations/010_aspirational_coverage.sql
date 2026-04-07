-- Migration 010: Add "aspirational" as a valid coverage value
-- Separates on-site evidence queries from market-authority (reputation) queries.

alter table report_query_coverage drop constraint if exists report_query_coverage_coverage_check;
alter table report_query_coverage add constraint report_query_coverage_coverage_check
  check (coverage in ('strong', 'partial', 'weak', 'aspirational'));
