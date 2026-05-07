// ─────────────────────────────────────────────────────────────────────────────
// OpenAI-compatible provider
//
// Works with: OpenAI, Groq, OpenRouter, Together AI, local Ollama
// (any server implementing the /v1/chat/completions endpoint)
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmCallOptions, LlmProvider } from "@/lib/types";
import { GroqQuotaError } from "@/lib/errors";

interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
}

const MAX_RETRIES = 3;

export class OpenAICompatibleProvider implements LlmProvider {
  constructor(private config: OpenAIConfig) {}

  async complete(options: LlmCallOptions, retries = 0): Promise<string> {
    const { messages, maxTokens, temperature = 0.3, jsonMode } = options;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: maxTokens ?? this.config.maxTokens,
      temperature,
    };

    // JSON mode — supported by OpenAI, Groq, and most compatible endpoints
    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          // OpenRouter requires this header
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "AI Visibility Report",
        },
        body: JSON.stringify(body),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText = await response.text();

      if (response.status === 429) {
        // Distinguish TPM/RPM rate limit (retry-able) from quota exhaustion (failover)
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(bodyText); } catch { /* ignore */ }
        const code = (parsed?.error as Record<string, unknown>)?.code as string | undefined;
        const isRateLimit = code === "rate_limit_exceeded";

        if (isRateLimit && retries < MAX_RETRIES) {
          // Extract suggested wait time from the error message, default to 7s
          const match = bodyText.match(/try again in ([\d.]+)s/i);
          const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 7_000;
          console.warn(`[OpenAI-compatible] TPM rate limit — retrying in ${waitMs}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, waitMs));
          return this.complete(options, retries + 1);
        }

        throw new GroqQuotaError(response.status, bodyText);
      }

      if (response.status === 402) {
        throw new GroqQuotaError(response.status, bodyText);
      }

      throw new Error(`[OpenAI-compatible] HTTP ${response.status}: ${bodyText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("[OpenAI-compatible] Empty response content");

    return content;
  }
}
