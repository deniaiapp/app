/**
 * Extract a Better Auth redirect response without allowing executable URL
 * schemes to reach a browser navigation sink.
 */
export function getAuthRedirectUrl(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;

  const record = data as { redirect?: unknown; url?: unknown };
  if (record.redirect !== true || typeof record.url !== "string" || !record.url.trim()) {
    return undefined;
  }

  try {
    const parsed = new URL(record.url, "https://deni-ai.invalid");
    if (["javascript:", "data:", "vbscript:"].includes(parsed.protocol)) return undefined;
  } catch {
    return undefined;
  }

  return record.url;
}
