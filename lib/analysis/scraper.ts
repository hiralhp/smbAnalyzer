// ─────────────────────────────────────────────────────────────────────────────
// Website Scraper
//
// Fetches a URL and extracts structured signals using cheerio (HTML parsing).
// No headless browser — lightweight and fast for MVP.
//
// TODO: For JS-heavy SPAs, consider adding a Puppeteer/Playwright fallback
//       behind a feature flag or separate worker endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from "cheerio";
import type { WebsiteAnalysis } from "@/lib/types";

const FETCH_TIMEOUT_MS = 15_000;
const BODY_TEXT_MAX_CHARS = 2_000;

// Keywords used in heuristic signal detection
const FAQ_KEYWORDS = ["faq", "frequently asked", "common questions", "q&a", "questions & answers"];
const INTEGRATION_KEYWORDS = [
  "integration", "integrates with", "connects with", "works with",
  "native integration", "third-party", "zapier", "slack", "salesforce",
];
const APPOINTMENT_KEYWORDS = [
  "book an appointment", "schedule a", "book a consultation",
  "book now", "schedule now", "schedule your", "request an appointment",
];
const ROOMS_KEYWORDS = [
  "room", "suite", "check-in", "check-out", "nightly",
  "per night", "guest room", "king room", "queen room", "standard room",
];
const BLOG_CONTENT_KEYWORDS = [
  "blog", "newsletter", "podcast", "subscribe to our",
  "episode", "our latest articles", "read more", "magazine",
];
const TRUST_KEYWORDS = ["certified", "licensed", "insured", "award", "accredited", "guarantee", "warranty", "bbb", "years of experience", "family owned"];
const PRICING_KEYWORDS = ["price", "pricing", "cost", "rate", "fee", "quote", "estimate", "starting at", "$", "free"];
const TESTIMONIAL_KEYWORDS = ["testimonial", "review", "what our customers", "what clients say", "5 star", "★", "⭐"];
const HOURS_KEYWORDS = ["monday", "tuesday", "hours", "open", "closed", "am", "pm", "24/7", "24 hours"];
const CONTACT_PATTERNS = [
  /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/,   // (555) 555-5555
  /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,    // 555-555-5555
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,    // email
];

/** Normalize a URL — adds https:// if no scheme is present */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty URL");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Extract the base origin from a URL for relative link resolution */
function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Scrape a URL and return a structured WebsiteAnalysis.
 * Never throws — errors are captured in the `fetchError` field.
 */
export async function scrapeWebsite(
  url: string,
  options: { isCompetitor?: boolean; competitorName?: string } = {}
): Promise<WebsiteAnalysis> {
  const base: WebsiteAnalysis = {
    url,
    isCompetitor: options.isCompetitor ?? false,
    competitorName: options.competitorName,
    h1Headings: [],
    h2Headings: [],
    internalLinks: [],
    hasServicePages: false,
    hasFaq: false,
    hasLocationMention: false,
    hasTrustSignals: false,
    hasContactInfo: false,
    hasHours: false,
    hasPricing: false,
    hasTestimonials: false,
  };

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch (e) {
    return { ...base, fetchError: `Invalid URL: ${url}` };
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIVisibilityBot/1.0; +https://aivisibility.report)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ...base, fetchError: `HTTP ${res.status} ${res.statusText}` };
    }
    html = await res.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, fetchError: `Fetch failed: ${msg}` };
  }

  // ── Parse HTML ──────────────────────────────────────────────────────────────
  const $ = cheerio.load(html);
  const origin = getOrigin(normalizedUrl);

  // Extract og:site_name and schema.org name BEFORE removing script elements
  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim() || undefined;

  // ── Structured data extraction (JSON-LD + microdata) ────────────────────────
  let schemaOrgName: string | undefined;
  let schemaOrgAddress: { street?: string; city?: string; state?: string; zip?: string } | undefined;

  // 1. JSON-LD (application/ld+json)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      const items = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
      for (const item of items) {
        if (!schemaOrgName && typeof item.name === "string" && item.name.trim()) {
          schemaOrgName = item.name.trim();
        }
        if (!schemaOrgAddress && item.address && typeof item.address === "object") {
          const addr = item.address as Record<string, unknown>;
          const city = typeof addr.addressLocality === "string" ? addr.addressLocality.trim() : undefined;
          const state = typeof addr.addressRegion === "string" ? addr.addressRegion.trim() : undefined;
          const street = typeof addr.streetAddress === "string" ? addr.streetAddress.trim() : undefined;
          const zip = typeof addr.postalCode === "string" ? addr.postalCode.trim() : undefined;
          if (city || street) {
            schemaOrgAddress = { street, city, state, zip };
          }
        }
        if (schemaOrgName && schemaOrgAddress) break;
      }
    } catch { /* ignore malformed JSON-LD */ }
  });

  // 2. Microdata (itemprop) — fallback when JSON-LD is absent/incomplete
  if (!schemaOrgName) {
    const microdataName =
      $('[itemprop="name"]').first().text().trim() ||
      $('[itemprop="legalName"]').first().text().trim();
    if (microdataName && microdataName.length > 1) schemaOrgName = microdataName;
  }
  if (!schemaOrgAddress) {
    const microStreet   = $('[itemprop="streetAddress"]').first().text().trim() || undefined;
    const microCity     = $('[itemprop="addressLocality"]').first().text().trim() || undefined;
    const microState    = $('[itemprop="addressRegion"]').first().text().trim() || undefined;
    const microZip      = $('[itemprop="postalCode"]').first().text().trim() || undefined;
    if (microCity || microStreet) {
      schemaOrgAddress = { street: microStreet, city: microCity, state: microState, zip: microZip };
    }
  }

  // 3. <meta name="city"> / <meta name="state"> — common on hotel and local-business sites
  const metaCity = $('meta[name="city"]').attr("content")?.trim() || undefined;
  const metaState = $('meta[name="state"]').attr("content")?.trim() || undefined;

  // Remove noisy elements before text extraction
  $("script, style, noscript, nav, footer, [aria-hidden='true']").remove();

  const title = $("title").first().text().trim() || undefined;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || undefined;

  const h1Headings = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const h2Headings = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 10);

  // Extract body text sample for LLM context
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const bodyTextSample = bodyText.slice(0, BODY_TEXT_MAX_CHARS);

  // ── Internal links ──────────────────────────────────────────────────────────
  const internalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("/") || href.startsWith(origin)) {
      const normalized = href.startsWith("/") ? `${origin}${href}` : href;
      if (!internalLinks.includes(normalized)) {
        internalLinks.push(normalized);
      }
    }
  });

  // ── Signal detection ────────────────────────────────────────────────────────
  const fullText = (
    (title ?? "") +
    " " +
    (metaDescription ?? "") +
    " " +
    h1Headings.join(" ") +
    " " +
    h2Headings.join(" ") +
    " " +
    bodyTextSample
  ).toLowerCase();

  // Pattern-routing signals — searched in raw HTML text before script removal
  // (cheaper than re-parsing; keyword matches are sufficient for routing)
  const rawHtmlLower = html.toLowerCase();
  const mentionsIntegrations = containsAny(rawHtmlLower, INTEGRATION_KEYWORDS);
  const mentionsAppointments = containsAny(rawHtmlLower, APPOINTMENT_KEYWORDS);
  const mentionsRoomsOrStays = containsAny(rawHtmlLower, ROOMS_KEYWORDS);
  const mentionsContentOrBlog = containsAny(rawHtmlLower, BLOG_CONTENT_KEYWORDS);

  // Service pages: internal links with service-y path segments
  const serviceLinkPatterns = ["service", "solution", "offering", "work", "what-we-do", "products"];
  const hasServicePages =
    internalLinks.some((link) =>
      serviceLinkPatterns.some((p) => link.toLowerCase().includes(p))
    ) ||
    h2Headings.some((h) =>
      serviceLinkPatterns.some((p) => h.toLowerCase().includes(p))
    );

  const hasFaq = containsAny(fullText, FAQ_KEYWORDS);
  const hasTrustSignals = containsAny(fullText, TRUST_KEYWORDS);
  const hasPricing = containsAny(fullText, PRICING_KEYWORDS);
  const hasTestimonials = containsAny(fullText, TESTIMONIAL_KEYWORDS);
  const hasHours = containsAny(fullText, HOURS_KEYWORDS);
  const hasContactInfo = matchesAny(bodyText, CONTACT_PATTERNS);

  // Location: check title, meta, H1, and structured data for location signals.
  const prominentForLocation = [title ?? "", metaDescription ?? "", ...h1Headings].join(" ");
  const prominentLocationLower = prominentForLocation.toLowerCase();
  // Also check first 500 chars of body (after script removal) for address patterns
  const bodySliceForLocation = bodyText.slice(0, 500);

  const hasLocationMention =
    // Structured address from JSON-LD / microdata / meta tags — authoritative
    !!(schemaOrgAddress?.city) ||
    !!(metaCity) ||
    // "Brooklyn, NY" — standard City, ST format
    /\b[a-z]{3,},\s*[a-z]{2}\b/.test(prominentLocationLower) ||
    // "Smyrna TN" — City + 2-letter state abbreviation with space (no comma)
    /\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]+)?\s+[A-Z]{2}\b/.test(prominentForLocation) ||
    // "South Williamsburg, Brooklyn" — multi-word neighborhood + city
    /\b[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)?,\s*[A-Z][a-zA-Z]{3,}\b/.test(prominentForLocation) ||
    // Street addresses — "178 Kent Ave", "1 Main Street"
    /\b\d+\s+[A-Za-z][a-zA-Z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl)\b/i.test(prominentForLocation) ||
    // Street address in body intro (footer often not in 2000-char sample)
    /\b\d+\s+[A-Za-z][a-zA-Z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl)\b/i.test(bodySliceForLocation) ||
    containsAny(prominentLocationLower, ["serving", "located in", "based in", "near "]);

  return {
    url: normalizedUrl,
    isCompetitor: options.isCompetitor ?? false,
    competitorName: options.competitorName,
    title,
    metaDescription,
    ogSiteName,
    schemaOrgName,
    schemaOrgAddress,
    metaCity,
    metaState,
    h1Headings,
    h2Headings,
    bodyTextSample,
    hasServicePages,
    hasFaq,
    hasLocationMention,
    hasTrustSignals,
    hasContactInfo,
    hasHours,
    hasPricing,
    hasTestimonials,
    mentionsIntegrations,
    mentionsAppointments,
    mentionsRoomsOrStays,
    mentionsContentOrBlog,
    internalLinks: internalLinks.slice(0, 20), // cap for storage
  };
}
