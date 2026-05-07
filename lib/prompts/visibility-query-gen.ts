// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Visibility Query Generation
//
// Asks the LLM to generate 4–6 realistic user queries for a given business
// type and location. These queries drive the visibility simulation — each one
// gets a full AI-response simulation to check if the business appears.
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryGenContext {
  businessName: string;
  businessType: string;
  location: string;
}

export function buildVisibilityQueryGenPrompt(ctx: QueryGenContext): { system: string; user: string } {
  const system = `You generate realistic user search queries for local business research. Output valid JSON only — no markdown, no commentary.

Rules:
- Queries must sound like a real person asking an AI assistant
- Vary query types: service-specific, amenity/policy, location-based, comparison
- Keep each query under 12 words
- Avoid generic queries like "local business services" or "things to do"
- Make queries reflect real user intent for the business category`;

  const locationHint = ctx.location ? ` in ${ctx.location}` : "";

  const user = `Business: "${ctx.businessName}"
Type: ${ctx.businessType}
Location: ${ctx.location || "unspecified"}

Generate 5 realistic queries a user would ask an AI assistant about this type of business.

Category guidance:
- Hotels → room rates, free breakfast, pet policy, parking, pool, check-in time, location
- Restaurants → cuisine type, delivery, best dishes, hours, reservations, price
- Home services → specific service, pricing, licensed/insured, availability, warranty
- Medical/dental → appointment availability, insurance, services offered, new patients
- Fitness/gym → membership cost, class schedule, amenities, personal training
- Retail → hours, parking, product selection, returns policy

Example queries${locationHint}:
- "pet-friendly hotels with free breakfast${locationHint}"
- "hotel parking rates downtown${locationHint}"
- "best pizza delivery open late${locationHint}"
- "affordable HVAC repair same day${locationHint}"

Return: {"queries": ["query 1", "query 2", "query 3", "query 4", "query 5"]}`;

  return { system, user };
}
