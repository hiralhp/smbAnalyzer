import type { QueryCoverageRow } from "@/lib/types";

interface QuerySemanticPrompt {
  system: string;
  user: string;
}

export function buildQuerySemanticPrompt(
  rows: QueryCoverageRow[],
  bodyText: string
): QuerySemanticPrompt {
  const queryList = rows
    .map((r) => `- "${r.query}" (currently: ${r.coverage})`)
    .join("\n");

  const truncatedBody = bodyText.slice(0, 3000);

  const system = `You are an expert in AI search optimization and semantic text analysis.
Your task is to determine whether a webpage semantically covers the intent of search queries, even when exact keywords are absent.
Respond ONLY with a valid JSON array. No explanation outside the JSON.`;

  const user = `Webpage content:
"""
${truncatedBody}
"""

For each query below, determine if the webpage content semantically covers the search intent — meaning a user searching this query would find the page relevant, even if the exact words differ (e.g. "animal hospital" covers "vet clinic").

Queries to evaluate:
${queryList}

Return a JSON array with one object per query:
[
  {
    "query": "<exact query string>",
    "covered": true or false,
    "reason": "<one sentence explaining why it is or isn't semantically covered>"
  }
]`;

  return { system, user };
}
