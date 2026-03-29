// ─────────────────────────────────────────────────────────────────────────────
// Website Inferrer
//
// When no URL is provided, attempts to discover the official website for a
// business using Grok, then falls back to a Yelp search page as the scrape
// target. The caller (pipeline) decides whether to use the inferred URL.
//
// Both functions are non-blocking and degrade gracefully.
// ─────────────────────────────────────────────────────────────────────────────

import { getGrokProvider } from "@/lib/llm/grok";

const VALIDATE_TIMEOUT_MS = 5_000;

async function validateUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    // Accept anything below 500 — redirects, auth walls (401/403) still confirm the host exists
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Normalize a raw string returned by Grok into a full https URL, or null. */
function normalizeWebsiteUrl(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "null") return null;
  // Must look like a domain or URL
  if (!/^https?:\/\/|^\w[\w-]+\.\w/.test(trimmed)) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

/**
 * Ask Grok to find the official website for a business by name + city.
 * Returns the validated https URL, or null when:
 * - Grok isn't configured (no XAI_API_KEY)
 * - LLM call or JSON parse fails
 * - Returned URL fails a HEAD validation check
 */
export async function inferWebsiteUrl(
  businessName: string,
  city: string
): Promise<string | null> {
  if (!businessName.trim()) return null;

  const provider = getGrokProvider();
  if (!provider) return null;

  const location = city ? ` located in ${city}` : "";

  const system = `You are a business research assistant. Your job is to find official business websites.
Return ONLY valid JSON: {"website": "https://example.com"} or {"website": null} if not found or uncertain.
NEVER return Yelp, TripAdvisor, Google Maps, Booking.com, Expedia, Facebook, or any review/directory/OTA site.
Return only the official domain of the business itself.`;

  const user = `Find the official website for: "${businessName}"${location}`;

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 100,
      temperature: 0,
      jsonMode: true,
    });
  } catch (err) {
    console.warn("[WebsiteInferrer] Grok call failed:", err);
    return null;
  }

  let candidate: string | null = null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    candidate = typeof parsed.website === "string"
      ? normalizeWebsiteUrl(parsed.website)
      : null;
  } catch {
    console.warn("[WebsiteInferrer] JSON parse failed:", raw.slice(0, 100));
    return null;
  }

  if (!candidate) return null;

  const valid = await validateUrl(candidate);
  if (!valid) {
    console.warn("[WebsiteInferrer] Inferred URL failed HEAD validation:", candidate);
    return null;
  }

  console.log("[WebsiteInferrer] Found official website:", candidate);
  return candidate;
}

/**
 * Build a Yelp business search URL as a fallback scrape target.
 * The Yelp search results page typically contains hours, address, reviews,
 * and business category — enough for useful coverage and local scoring.
 */
export function buildYelpSearchUrl(businessName: string, city: string): string {
  const name = encodeURIComponent(businessName);
  const loc = encodeURIComponent(city);
  return `https://www.yelp.com/search?find_desc=${name}&find_loc=${loc}`;
}
