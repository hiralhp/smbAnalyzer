// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Groq Category Classification
//
// Fast, lightweight prompt to infer/validate business category and subtype.
// Runs before downstream classification to seed or correct the sector.
// Works in both URL mode (uses scraped signals) and no-URL mode (name+city only).
//
// Input:  businessName, optional category hint, city, scraped page signals
// Output: { category, sector, subtype, confidence, reasoning }
// ─────────────────────────────────────────────────────────────────────────────

export interface GroqClassificationContext {
  businessName: string;
  formCategory: string | null;   // user-provided form category (optional hint)
  city: string | null;
  pageTitle: string | null;
  metaDescription: string | null;
  h1Headings: string[];
  bodyTextSample: string | null;
}

export function buildGroqClassificationPrompt(ctx: GroqClassificationContext): {
  system: string;
  user: string;
} {
  const system = `You are a business category classifier. Given a business name and optional website signals, identify the most specific business category. Output valid JSON only — no markdown, no commentary.`;

  const signalLines: string[] = [];
  if (ctx.formCategory) signalLines.push(`- User-selected category (TREAT AS DEFINITIVE unless clearly wrong): "${ctx.formCategory}"`);
  if (ctx.pageTitle) signalLines.push(`- Page title: "${ctx.pageTitle}"`);
  if (ctx.metaDescription) signalLines.push(`- Meta description: "${ctx.metaDescription.slice(0, 200)}"`);
  if (ctx.h1Headings.length > 0) signalLines.push(`- H1: "${ctx.h1Headings[0]}"`);
  if (ctx.bodyTextSample) signalLines.push(`- Body excerpt: "${ctx.bodyTextSample.slice(0, 600)}"`);
  if (ctx.city) signalLines.push(`- City: ${ctx.city}`);

  const signals = signalLines.length > 0
    ? signalLines.join("\n")
    : "(no additional signals available)";

  const user = `Classify this business:

Business name: "${ctx.businessName}"
${signals}

Identify:
1. category — specific type: "hotel", "restaurant", "coffee shop", "bakery", "bar", "dentist", "plumber", "hair salon", "gym", "law firm", "accountant", "retail store", etc.
2. sector — one of exactly: "food_and_beverage" | "retail_store" | "professional_services" | "home_services" | "health_wellness" | "hospitality" | "fitness" | "unknown"
3. subtype — specific subtype only when HIGH confidence (e.g. "italian restaurant", "yoga studio", "med spa"), else null
4. confidence — "high" (very clear from name/signals), "medium" (likely), "low" (uncertain)
5. reasoning — one sentence explaining the classification

STRICT RULES:
- If user-selected category is provided, use it as the primary signal. Override it only if the website content makes it absolutely impossible (e.g. user says "coffee shop" but site is clearly a law firm with no food mentions).
- Business name contains "Hotel", "Inn", "Resort", "Motel", "Lodge", "Suites", "B&B" → sector MUST be "hospitality"
- Business name contains "Restaurant", "Bistro", "Kitchen", "Grill", "Pizzeria", "Sushi", "Ramen", "Tacos" → sector MUST be "food_and_beverage"
- Business name contains "Café", "Cafe", "Coffee", "Roastery", "Espresso" → sector MUST be "food_and_beverage", subtype "coffee shop"
- Business name contains "Bakery", "Patisserie", "Boulangerie" → sector MUST be "food_and_beverage", subtype "bakery"
- Body/title/meta contains clear food & beverage signals (menu, espresso, latte, coffee, pastry, brunch, dine, eat, drinks, cocktails, cuisine, chef) AND no contradicting signals → sector MUST be "food_and_beverage"
- Business name is ambiguous (creative/brand name with no clear category keyword) → rely on body text signals, not the name alone
- Never assign a subtype that belongs to a different sector (e.g. NEVER assign "gym" or "yoga" subtype to a hotel)
- If uncertain, return "unknown" sector rather than guessing wrong

Output JSON:
{
  "category": "...",
  "sector": "...",
  "subtype": null,
  "confidence": "high",
  "reasoning": "..."
}`;

  return { system, user };
}
