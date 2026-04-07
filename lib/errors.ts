// ─────────────────────────────────────────────────────────────────────────────
// Shared error types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when the LLM provider returns a rate-limit or quota-exhaustion response
 * (HTTP 429 or 402). Treated as a non-fatal, recoverable error — the pipeline
 * continues with deterministic fallbacks and the UI surfaces a BYOK prompt.
 */
export class GroqQuotaError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`LLM quota/rate-limit: HTTP ${status}`);
    this.name = "GroqQuotaError";
  }
}

export function isGroqQuotaError(err: unknown): err is GroqQuotaError {
  return err instanceof GroqQuotaError;
}
