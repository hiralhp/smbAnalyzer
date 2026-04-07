-- Add evidence_note to explain why a query was downgraded from Strong to Partial
alter table report_query_coverage add column if not exists evidence_note text;
