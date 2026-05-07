interface ContentQualityPrompt {
  system: string;
  user: string;
}

interface ContentQualityInput {
  title?: string;
  metaDescription?: string;
  h1Headings: string[];
  bodyTextSample?: string;
  businessName?: string;
  city?: string;
}

export function buildContentQualityPrompt(
  input: ContentQualityInput
): ContentQualityPrompt {
  const system = `You are an expert in AI search optimization and content quality for local businesses.
Evaluate the quality of each content element for AI discoverability — not just presence, but how descriptive, specific, and locally relevant it is.
Respond ONLY with a valid JSON object. No explanation outside the JSON.`;

  const user = `Business context:
- Name: ${input.businessName || "unknown"}
- City: ${input.city || "unknown"}

Content to evaluate:
- Title tag: ${input.title || "(missing)"}
- Meta description: ${input.metaDescription || "(missing)"}
- H1 headings: ${input.h1Headings.length > 0 ? input.h1Headings.join(" | ") : "(missing)"}
- Body text sample: ${input.bodyTextSample ? input.bodyTextSample.slice(0, 800) : "(missing)"}

Rate each element for AI discoverability quality (0–10) and provide one specific, actionable improvement suggestion.
A score of 10 means the element is highly specific, mentions the service + location, and would help an AI clearly understand what the business does and where.
A score below 5 means it's generic, vague, or missing key context.

Return this exact JSON:
{
  "title": { "score": 0-10, "suggestion": "..." },
  "metaDescription": { "score": 0-10, "suggestion": "..." },
  "h1": { "score": 0-10, "suggestion": "..." },
  "bodyContent": { "score": 0-10, "suggestion": "..." }
}`;

  return { system, user };
}
