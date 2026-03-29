// ─────────────────────────────────────────────────────────────────────────────
// Website Pattern Detector
//
// Maps scraper signals + classifier outputs to a single WebsitePattern value
// used as the routing key for FAQ generation and query coverage.
//
// Rules are evaluated in priority order — first match wins.
// Scoring/recommendations are NOT affected by this module.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis, BusinessProfile, BusinessFeatures, WebsitePattern, LlmExtractedSignals } from "@/lib/types";

/**
 * Derive a single WebsitePattern from scraper signals and classifier outputs.
 * The result is written to `profile.website_pattern` in the pipeline and is
 * never overridden downstream.
 *
 * When `llmSignals` is provided, each pattern-routing signal is resolved by
 * OR-merging the deterministic scraper value with the LLM-extracted value so
 * that either source can trigger a pattern upgrade.
 */
export function detectWebsitePattern(
  analysis: WebsiteAnalysis,
  profile: BusinessProfile,
  _features: BusinessFeatures,
  llmSignals?: LlmExtractedSignals | null
): WebsitePattern {
  const om = profile.offering_model;

  // Merge deterministic + LLM signals (OR — either source can fire the rule)
  const effIntegrations  = analysis.mentionsIntegrations  || llmSignals?.mentions_integrations  || false;
  const effAppointments  = analysis.mentionsAppointments  || llmSignals?.mentions_appointments  || false;
  const effRoomsOrStays  = analysis.mentionsRoomsOrStays  || llmSignals?.mentions_rooms_or_stays || false;
  const effContentOrBlog = analysis.mentionsContentOrBlog || llmSignals?.mentions_content_or_blog || false;

  // 1. Hospitality — rooms/suites are a unique structural signal
  if (
    effRoomsOrStays ||
    om.includes("bookable_rooms") ||
    profile.business_model === "accommodation"
  ) {
    return "hospitality_booking";
  }

  // 2. Software — integrations language is a near-unique SaaS signal.
  // GUARD: skip for definitively physical/local sectors. Reservation widgets,
  // online ordering platforms, and delivery app embeds (common on restaurant /
  // retail / hospitality sites) produce false-positive integration signals from
  // the LLM extractor. The sector classification is the authoritative source.
  const NEVER_SOFTWARE_SECTORS = new Set([
    "food_and_beverage", "retail_store", "hospitality",
    "home_services", "health_wellness", "fitness",
  ]);
  if (effIntegrations && !NEVER_SOFTWARE_SECTORS.has(profile.sector ?? "")) {
    return "software_product";
  }

  // 3. E-commerce — catalog offering is strong from classifier
  if (om.includes("ecommerce_catalog")) {
    return "catalog_ecommerce";
  }

  // 4. Appointment-based services
  if (effAppointments || om.includes("appointment_based")) {
    return "appointment_service";
  }

  // 5. Content brands (no physical/local signals)
  if (effContentOrBlog && !analysis.hasLocationMention && !analysis.hasHours) {
    return "content_brand";
  }

  // 6. Local physical — broadest local catch
  // Note: service_area_business (HVAC, plumbing) → local_physical_business.
  // These are local trades, not clinic-style appointment services.
  if (
    om.includes("menu_based") ||
    om.includes("physical_location") ||
    om.includes("service_area_business") ||
    analysis.hasLocationMention ||
    analysis.hasHours
  ) {
    return "local_physical_business";
  }

  return "generic_unknown";
}
