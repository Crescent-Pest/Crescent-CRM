import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Claude API helpers shared by /api/identify and /api/plan.
 * The API key never leaves the server.
 */

/** Model is configurable via env; defaults to Claude Fable 5 for the best
 * vision ID quality. "claude-opus-5" is the cheaper/faster alternative.
 * Never pass thinking/temperature/top_p/top_k — these models reject them. */
export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-fable-5";
}

/** Refusal fallbacks (beta): if the model's safety classifiers decline a
 * request (vision inputs can rarely trip them), the API transparently re-runs
 * it on Anthropic's recommended fallback model instead of failing the
 * inspection. A refusal on the final response means the whole chain refused. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const MISSING_KEY_MESSAGE =
  "AI not configured yet — add ANTHROPIC_API_KEY to the environment and redeploy.";

export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

export interface ApiFailure {
  message: string;
  status: number;
}

/** Map SDK errors to a user-friendly message + HTTP status for the UI. */
export function friendlyClaudeError(err: unknown): ApiFailure {
  if (err instanceof Anthropic.AuthenticationError) {
    return {
      message: "The AI key was rejected — check ANTHROPIC_API_KEY in the environment.",
      status: 502,
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      message: "The AI service is busy right now. Wait a minute and try again.",
      status: 503,
    };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return {
      message: "The AI service rejected this request. Try retaking the photo.",
      status: 502,
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      message: "Couldn't reach the AI service. Check your connection and try again.",
      status: 503,
    };
  }
  if (err instanceof Anthropic.APIError) {
    return {
      message: "The AI service had a problem. Try again in a moment.",
      status: 502,
    };
  }
  return {
    message: "Something went wrong on our side. Try again.",
    status: 500,
  };
}

/** First text block of a response, or null. */
export function firstText(
  content: { type: string }[]
): string | null {
  for (const block of content) {
    if (block.type === "text" && "text" in block) {
      return (block as { text: string }).text;
    }
  }
  return null;
}
