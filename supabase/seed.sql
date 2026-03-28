-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Sample completed report for "Blue Ridge HVAC" — demo / testing
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

-- Scores
insert into report_scores (report_id, overall_score, content_clarity_score, service_specificity_score, local_relevance_score, trust_signal_score, faq_discoverability_score) values
  ('22222222-2222-2222-2222-222222222222', 62, 70, 55, 65, 50, 40);

-- Findings
insert into report_findings (report_id, type, category, label, detail) values
  ('22222222-2222-2222-2222-222222222222', 'strength', 'content',  'Clear title tag',            'Title clearly identifies the business and service area'),
  ('22222222-2222-2222-2222-222222222222', 'strength', 'local',    'Location mentioned',         'Asheville, NC appears in H1 and body text'),
  ('22222222-2222-2222-2222-222222222222', 'strength', 'trust',    'Phone number visible',       'Contact phone number present in header'),
  ('22222222-2222-2222-2222-222222222222', 'gap',      'faq',      'No FAQ section detected',    'Adding an FAQ section helps AI answer customer questions directly'),
  ('22222222-2222-2222-2222-222222222222', 'gap',      'content',  'No dedicated service pages', 'Individual pages per service improve AI discoverability'),
  ('22222222-2222-2222-2222-222222222222', 'gap',      'trust',    'No embedded reviews',        'Customer testimonials increase trust signals for AI systems'),
  ('22222222-2222-2222-2222-222222222222', 'gap',      'content',  'Weak pricing language',      'Pricing context helps qualify traffic and AI intent matching');

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
   'Strengthen local signals',
   'Add neighborhood or county references beyond just "Asheville, NC". Mention surrounding areas you serve to expand local discoverability.',
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
