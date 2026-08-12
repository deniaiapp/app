export const GENERIC_CHAT_REQUEST_ERROR = "An unexpected error occurred.";

const USER_FACING_SUBSTRINGS = [
  "usage limit",
  "context window",
  "not available on the free plan",
  "not available for guest sessions",
];

export function isContextOverflowMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("context window") ||
    normalized.includes("maximum context length") ||
    normalized.includes("model_context_window_exceeded") ||
    normalized.includes("prompt is too long") ||
    normalized.includes("too many input tokens") ||
    normalized.includes("input is too long")
  );
}

export function isUserFacingChatRequestError(message: string): boolean {
  const normalized = message.toLowerCase();
  return USER_FACING_SUBSTRINGS.some((part) => normalized.includes(part));
}

function readErrorMessage(error: unknown): string | undefined {
  if (typeof error === "string") {
    return error.trim() || undefined;
  }

  if (error && typeof error === "object") {
    const message = "message" in error ? error.message : undefined;
    if (typeof message === "string" && message.trim()) {
      return message;
    }

    const cause = "cause" in error ? error.cause : undefined;
    if (cause) {
      return readErrorMessage(cause);
    }
  }

  return undefined;
}

/** Pull a human string out of useChat errors, including raw JSON HTTP bodies. */
export function extractChatRequestErrorText(error: unknown): string | undefined {
  const raw = readErrorMessage(error);
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
    } catch {
      // Fall through and treat the raw text as the message.
    }
  }

  return raw;
}

export function toDisplayChatRequestError(error: unknown, fallback: string): string {
  const text = extractChatRequestErrorText(error);
  if (text && isUserFacingChatRequestError(text)) {
    return text;
  }
  return fallback;
}
