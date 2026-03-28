// ─────────────────────────────────────────────────────────────────────────────
// Anthropic provider (native Messages API)
//
// Does NOT use the anthropic SDK package — calls the HTTP API directly so
// the app has zero provider-specific dependencies in package.json.
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmCallOptions, LlmProvider } from "@/lib/types";

interface AnthropicConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export class AnthropicProvider implements LlmProvider {
  constructor(private config: AnthropicConfig) {}

  async complete(options: LlmCallOptions): Promise<string> {
    const { messages, maxTokens, temperature = 0.3, jsonMode } = options;

    // Separate system message from the conversation
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    // If jsonMode is requested, append instruction to system prompt
    const systemContent = [
      systemMessage?.content ?? "",
      jsonMode ? "\n\nYou MUST respond with valid JSON only. No markdown, no commentary." : "",
    ]
      .join("")
      .trim();

    const body = {
      model: this.config.model,
      max_tokens: maxTokens ?? this.config.maxTokens,
      temperature,
      ...(systemContent ? { system: systemContent } : {}),
      messages: conversationMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[Anthropic] HTTP ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const content = data.content?.find((c) => c.type === "text")?.text;
    if (!content) throw new Error("[Anthropic] Empty response content");

    return content;
  }
}
