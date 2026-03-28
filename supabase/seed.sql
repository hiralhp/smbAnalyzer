-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Sample completed report for "Blue Ridge HVAC" — demo / testing
-- Updated for 002_data_enrichment schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Business
insert into businesses (id, name, website_url, category, city) values
  ('11111111-1111-1111-1111-111111111111',
   'Blue Ridge HVAC',
   'https://example-hvac.com',
   'HVAC / Home Services',
   'Asheville, NC');

-- Report
insert into reports (id, business_id, status) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'complete');

-- Report inputs
insert into report_inputs (report_id, business_name, website_url, category, city, top_services) values
  ('22222222-2222-2222-2222-222222222222',
   'Blue Ridge HVAC',
   'https://example-hvac.com',
   'HVAC / Home Services',
   'Asheville, NC',
   ARRAY['AC Repair', 'Furnace Installation', 'Duct Cleaning']);

-- Scores (with explanation jsonb — new in 002_data_enrichment)
insert into report_scores (report_id, overall_score, content_clarity_score, service_specificity_score, local_relevance_score, trust_signal_score, faq_discoverability_score, explanation) values
  ('22222222-2222-2222-2222-222222222222', 62, 70, 55, 65, 50, 40,
   '{
     "overall": "Moderate AI visibility. 3 signals detected, 4 gaps to address.",
     "content_clarity": "Title and H1 present, but topical depth is limited.",
     "service_specificity": "Missing: no dedicated service pages.",
     "local_relevance": "City found in headings but not in the title tag.",
     "trust_signals": "Missing: no embedded reviews or testimonials.",
     "faq_discoverability": "No FAQ section detected — highest impact gap for AI discoverability."
   }'::jsonb);

-- Findings (with evidence + confidence + source_signal + rule_id — new in 002_data_enrichment)
insert into report_findings (report_id, type, category, label, detail, confidence, evidence, source_signal, source_url, rule_id) values
  ('22222222-2222-2222-2222-222222222222', 'strength', 'content',  'Clear title tag',
   'Title clearly identifies the business and service area',
   'high', '<title> tag found: "Blue Ridge HVAC | Asheville, NC"', 'title_tag', 'https://example-hvac.com', 'title_tag_present'),

  ('22222222-2222-2222-2222-222222222222', 'strength', 'local',    'Location mentioned',
   'Asheville, NC appears in H1 and body text',
   'medium', 'Location language detected in title or H1.', 'location_mention', 'https://example-hvac.com', 'location_mention'),

  ('22222222-2222-2222-2222-222222222222', 'strength', 'trust',    'Contact information present',
   'Phone number or email address detected on the page.',
   'high', 'Phone number pattern matched on the page.', 'contact_info', 'https://example-hvac.com', 'contact_info_present'),

  ('22222222-2222-2222-2222-222222222222', 'gap',      'faq',      'No FAQ section detected',
   'A FAQ section is the single highest-impact change for AI discoverability.',
   'medium', 'No FAQ-like headings or sections found ("faq", "frequently asked", "common questions", "q&a").', 'has_faq', 'https://example-hvac.com', 'faq_present'),

  ('22222222-2222-2222-2222-222222222222', 'gap',      'service',  'No dedicated service pages',
   'Creating separate pages for each service dramatically improves AI discoverability.',
   'medium', 'No service-specific navigation links found (/services, /solutions, /work).', 'service_pages', 'https://example-hvac.com', 'service_pages_present'),

  ('22222222-2222-2222-2222-222222222222', 'gap',      'trust',    'No embedded reviews or testimonials',
   'Customer reviews embedded directly on your site strengthen AI trust signals.',
   'medium', 'No review or testimonial language found ("testimonial", "review", "5 star").', 'testimonials', 'https://example-hvac.com', 'testimonials_present'),

  ('22222222-2222-2222-2222-222222222222', 'gap',      'trust',    'No professional trust indicators',
   'Mentioning licensing, certifications, or guarantees directly boosts AI trust scoring.',
   'medium', 'No credential language found ("licensed", "certified", "insured", "accredited").', 'trust_keywords', 'https://example-hvac.com', 'trust_keywords_present');

-- Recommendations
insert into report_recommendations (report_id, priority, title, description, impact, effort) values
  ('22222222-2222-2222-2222-222222222222', 1,
   'Add a dedicated FAQ page',
   'Create a FAQ page answering the top 8–10 questions customers ask about HVAC services in Asheville. This is the single highest-impact change for AI discoverability.',
   'high', 'low'),
  ('22222222-2222-2222-2222-222222222222', 2,
   'Create individual service pages',
   'Build separate pages for AC Repair, Furnace Installation, and Duct Cleaning. Each page should include what the service is, who needs it, pricing range, and local context.',
   'high', 'medium'),
  ('22222222-2222-2222-2222-222222222222', 3,
   'Embed customer reviews on homepage',
   'Add 3–5 real customer testimonials directly on the homepage. AI systems use review content to confirm business quality and relevance.',
   'medium', 'low'),
  ('22222222-2222-2222-2222-222222222222', 4,
   'Add trust credentials to your site',
   'Prominently display your license number, insurance status, or certifications. Phrases like "Licensed, bonded & insured" directly boost AI trust signals.',
   'medium', 'low');

-- LLM output (mocked for seed)
insert into report_llm_outputs (report_id, positioning_summary, top_strengths, top_opportunities, content_asset_type, content_asset_draft, model_used) values
  ('22222222-2222-2222-2222-222222222222',
   'Blue Ridge HVAC has a solid local presence in Asheville, NC with clear contact information and basic service descriptions. The site is recognizable to local customers but lacks the structured, AI-readable content that helps AI assistants confidently recommend the business when someone asks for HVAC services in the area.',
   ARRAY[
     'Strong local identification — Asheville, NC is clearly communicated',
     'Contact information is prominent and easy to find',
     'Service categories are mentioned, giving AI systems a starting point'
   ],
   ARRAY[
     'No FAQ section means AI cannot surface direct answers about your services',
     'Individual service pages would dramatically improve AI indexing accuracy',
     'Customer review content is absent from the site itself'
   ],
   'faq',
   E'## Frequently Asked Questions — Blue Ridge HVAC\n\n**How quickly can you respond to an AC emergency in Asheville?**\nWe offer same-day emergency service for most HVAC failures in the Asheville area. Call us and we''ll tell you our current availability.\n\n**Do you service both residential and commercial properties?**\nYes, we handle HVAC systems for homes, rental properties, and small commercial spaces across Asheville and surrounding WNC counties.\n\n**What HVAC brands do you work with?**\nOur technicians are trained on all major brands including Carrier, Trane, Lennox, and Rheem.\n\n**How much does a furnace installation cost in Asheville?**\nFurnace installation typically ranges from $2,500 to $5,500 depending on unit size, efficiency rating, and existing ductwork. We provide free estimates.\n\n**Do you offer financing?**\nYes, we partner with GreenSky to offer 0% financing on qualifying installations.',
   'seed-mock');

-- Website analysis (with enriched fields — new in 002_data_enrichment)
insert into website_analyses (
  report_id, url, is_competitor,
  title, meta_description,
  h1_headings, h2_headings, body_text_sample,
  has_service_pages, has_faq, has_location_mention, has_trust_signals,
  has_contact_info, has_hours, has_pricing, has_testimonials,
  scanned_page_type,
  detected_location_terms, detected_service_terms,
  evidence_snapshot
) values (
  '22222222-2222-2222-2222-222222222222',
  'https://example-hvac.com',
  false,
  'Blue Ridge HVAC | Asheville, NC',
  'Professional HVAC services in Asheville, NC. Call Blue Ridge HVAC for AC repair, furnace installation, and duct cleaning.',
  ARRAY['Blue Ridge HVAC — Heating & Cooling in Asheville, NC'],
  ARRAY['Our Services', 'AC Repair & Installation', 'About Us', 'Contact'],
  'Blue Ridge HVAC provides professional heating and cooling services across Asheville, NC and surrounding communities. Call us today.',
  false, false, true, false,
  true, false, false, false,
  'homepage',
  ARRAY['Asheville, NC', 'Asheville'],
  ARRAY['AC Repair', 'Furnace Installation'],
  '{
    "title": "Blue Ridge HVAC | Asheville, NC",
    "h1Count": 1,
    "h2Count": 4,
    "hasServicePages": false,
    "hasFaq": false,
    "hasContactInfo": true,
    "hasLocationMention": true
  }'::jsonb
);

-- Report signals (new table — 002_data_enrichment)
insert into report_signals (report_id, signal_name, signal_value, signal_type, confidence, evidence, source_url) values
  ('22222222-2222-2222-2222-222222222222', 'has_title',            'true',  'boolean', 'high',   '<title> tag found: "Blue Ridge HVAC | Asheville, NC"', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_meta_description', 'true',  'boolean', 'high',   'Meta description found and 120 chars.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'h1_count',             '1',     'count',   'high',   '1 H1 heading found.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'h2_count',             '4',     'count',   'high',   '4 H2 headings found.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_faq',              'false', 'boolean', 'medium', 'No FAQ-like sections detected.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_service_pages',    'false', 'boolean', 'medium', 'No service navigation links found.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_contact_info',     'true',  'boolean', 'high',   'Phone number pattern detected.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_trust_signals',    'false', 'boolean', 'medium', 'No credential language found.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_testimonials',     'false', 'boolean', 'medium', 'No testimonial content found.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'has_location_mention', 'true',  'boolean', 'medium', 'Location language detected in title.', 'https://example-hvac.com'),
  ('22222222-2222-2222-2222-222222222222', 'location_in_title',    'true',  'boolean', 'high',   '"Asheville, NC" found in title.', 'https://example-hvac.com');

-- Query coverage (new table — 002_data_enrichment)
insert into report_query_coverage (report_id, query, query_type, coverage, missing_terms, matched_terms, title_match, heading_match, body_match, service_page_match) values
  ('22222222-2222-2222-2222-222222222222', 'best HVAC in Asheville',       'brand_local',       'strong',  ARRAY[]::text[], ARRAY['hvac', 'asheville'], true,  true,  true,  false),
  ('22222222-2222-2222-2222-222222222222', 'HVAC near Asheville',          'proximity_local',   'strong',  ARRAY[]::text[], ARRAY['hvac', 'asheville'], true,  true,  true,  false),
  ('22222222-2222-2222-2222-222222222222', 'affordable HVAC Asheville',    'price_local',       'partial', ARRAY['affordable'], ARRAY['asheville'],     false, false, true,  false),
  ('22222222-2222-2222-2222-222222222222', 'HVAC reviews Asheville',       'reputation_local',  'weak',    ARRAY['review'], ARRAY['asheville'],         false, false, false, false),
  ('22222222-2222-2222-2222-222222222222', 'HVAC near me',                 'proximity_generic', 'partial', ARRAY[]::text[], ARRAY['hvac'],              true,  true,  true,  false),
  ('22222222-2222-2222-2222-222222222222', 'ac repair in Asheville',       'service_local',     'partial', ARRAY[]::text[], ARRAY['ac repair', 'asheville'], false, true, true, false),
  ('22222222-2222-2222-2222-222222222222', 'ac repair near me',            'service_proximity', 'partial', ARRAY[]::text[], ARRAY['ac repair'],         false, true,  true,  false),
  ('22222222-2222-2222-2222-222222222222', 'furnace installation Asheville','service_local',    'partial', ARRAY[]::text[], ARRAY['furnace installation', 'asheville'], false, false, true, false),
  ('22222222-2222-2222-2222-222222222222', 'duct cleaning near me',        'service_proximity', 'weak',    ARRAY['duct cleaning'], ARRAY[]::text[],     false, false, false, false);
