// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Signal Extraction
//
// Takes scraped website content and asks the LLM to classify the 10 boolean
// signals that drive website pattern routing and query coverage generation.
//
// Input: structured content fields — NO raw HTML
// Output: strict JSON matching LlmExtractedSignals type
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis } from "@/lib/types";

export function buildSignalExtractionPrompt(analysis: WebsiteAnalysis): {
  system: string;
  user: string;
} {
  const system = `You are a website content classifier. Analyze the provided webpage text and return a JSON object with exactly 10 boolean fields. Output valid JSON only — no markdown, no commentary.`;

  const contentParts = [
    analysis.title && `Title: ${analysis.title}`,
    analysis.metaDescription && `Meta description: ${analysis.metaDescription}`,
    analysis.h1Headings.length > 0 && `H1 headings: ${analysis.h1Headings.join(" | ")}`,
    analysis.h2Headings.length > 0 && `H2 headings: ${analysis.h2Headings.slice(0, 8).join(" | ")}`,
    analysis.bodyTextSample && `Page text sample: ${analysis.bodyTextSample.slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const user = `Classify whether each signal is present on this webpage.

## Webpage Content
${contentParts || "No content available"}

## Output Format
Return ONLY this JSON object with boolean values:
{
  "has_pricing": boolean,
  "mentions_integrations": boolean,
  "mentions_booking": boolean,
  "mentions_physical_location": boolean,
  "mentions_menu": boolean,
  "mentions_appointments": boolean,
  "mentions_rooms_or_stays": boolean,
  "mentions_products_for_sale": boolean,
  "mentions_content_or_blog": boolean,
  "mentions_contact_info": boolean
}

Definitions:
- has_pricing: page shows prices, rates, fees, or "starting at" language
- mentions_integrations: software integration language ("integrates with", "connects to", "API", "Zapier", "Slack", etc.)
- mentions_booking: any booking/reservation system language
- mentions_physical_location: street address, city mention, "visit us", "in [city]", directions
- mentions_menu: food menu, drinks menu, catalog of food items, "order online"
- mentions_appointments: appointment scheduling language ("book an appointment", "schedule a visit", "see a doctor")
- mentions_rooms_or_stays: hotel/accommodation language ("room", "suite", "check-in", "nightly rate", "per night")
- mentions_products_for_sale: products with add-to-cart, e-commerce, "shop now", SKU, product listings
- mentions_content_or_blog: blog, newsletter, podcast, articles, "subscribe", content publishing
- mentions_contact_info: phone number, email address, contact form`;

  return { system, user };
}
