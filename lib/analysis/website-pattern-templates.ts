// ─────────────────────────────────────────────────────────────────────────────
// Website Pattern Templates
//
// Static lookup tables keyed on WebsitePattern — used by FAQ generator and
// query coverage to emit pattern-appropriate questions and query intents.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsitePattern } from "@/lib/types";

export const PATTERN_FAQ_QUESTIONS: Record<WebsitePattern, string[]> = {
  software_product: [
    "What does this product do?",
    "Who is it for?",
    "How does pricing work?",
    "What integrations are supported?",
    "Is there a free trial or demo?",
    "How is data secured?",
    "How do I get started?",
    "What support options are available?",
    "Can I migrate existing data?",
    "Is there a public API?",
  ],
  local_physical_business: [
    "What are your hours?",
    "Where are you located?",
    "Do you accept walk-ins or reservations?",
    "Is parking available?",
    "How can I contact you?",
    "What payment methods do you accept?",
    "Do you offer gift cards?",
    "Are you family-friendly?",
    "What is your cancellation policy?",
    "Do you have accessibility accommodations?",
  ],
  appointment_service: [
    "What services do you offer?",
    "How do I book an appointment?",
    "What areas do you serve?",
    "Are you licensed and insured?",
    "What is your pricing structure?",
    "How do I prepare for my appointment?",
    "What is your cancellation policy?",
    "Do you offer free estimates?",
    "How long does a typical visit take?",
    "Do you offer emergency or same-day service?",
  ],
  hospitality_booking: [
    "What are check-in and check-out times?",
    "What amenities are included?",
    "What is the cancellation policy?",
    "Is parking available?",
    "How do I make a reservation?",
    "Is breakfast included?",
    "Are pets allowed?",
    "Is Wi-Fi available?",
    "What is the minimum stay?",
    "What is nearby the property?",
  ],
  catalog_ecommerce: [
    "What products do you sell?",
    "What are shipping times and costs?",
    "What is your return policy?",
    "Do you offer discounts or promo codes?",
    "Is my payment information secure?",
    "Do you ship internationally?",
    "How do I track my order?",
    "What payment methods do you accept?",
    "Can I modify or cancel an order?",
    "Do you offer wholesale pricing?",
  ],
  content_brand: [
    "What topics do you cover?",
    "How can I subscribe or follow?",
    "Do you accept guest contributions?",
    "Do you offer partnerships or sponsorships?",
    "How often is new content published?",
    "Is content free or behind a paywall?",
    "Do you have a newsletter?",
    "Can I share your content?",
    "How do I contact the editorial team?",
    "Do you host events or webinars?",
  ],
  generic_unknown: [
    "What services or products do you offer?",
    "How can I contact you?",
    "Where are you located?",
    "What are your hours?",
    "How do I get started?",
    "What makes you different from competitors?",
    "Do you have customer reviews or testimonials?",
    "What are your payment options?",
    "Do you offer a free consultation?",
    "How long have you been in business?",
  ],
};

export const PATTERN_QUERY_INTENTS: Record<WebsitePattern, string[]> = {
  software_product:        ["pricing", "free trial", "integrations", "documentation", "demo"],
  local_physical_business: ["hours", "location", "reviews", "parking", "near me"],
  appointment_service:     ["book appointment", "pricing", "services", "availability", "near me"],
  hospitality_booking:     ["rooms", "rates", "amenities", "availability", "check-in"],
  catalog_ecommerce:       ["shop", "buy online", "shipping", "returns", "discount"],
  content_brand:           ["articles", "subscribe", "newsletter", "podcast", "blog"],
  generic_unknown:         ["services", "contact", "about", "pricing"],
};

export const PATTERN_NOUNS: Record<WebsitePattern, string> = {
  software_product:        "software platform",
  local_physical_business: "business",
  appointment_service:     "service",
  hospitality_booking:     "hotel",
  catalog_ecommerce:       "store",
  content_brand:           "publication",
  generic_unknown:         "business",
};
