// ─────────────────────────────────────────────────────────────────────────────
// OpenAI-compatible provider
//
// Works with: OpenAI, Groq, OpenRouter, Together AI, local Ollama
// (any server implementing the /v1/chat/completions endpoint)
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmCallOptions, LlmProvider } from "@/lib/types";

interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
}

export class OpenAICompatibleProvider implements LlmProvider {
  constructor(private config: OpenAIConfig) {}

  async complete(options: LlmCallOptions): Promise<string> {
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
      const error = await response.text();
      throw new Error(
        `[OpenAI-compatible] HTTP ${response.status}: ${error}`
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("[OpenAI-compatible] Empty response content");

    return content;
  }
}
