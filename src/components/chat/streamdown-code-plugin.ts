import type { PluginConfig } from "streamdown";
import { highlightCode } from "@/lib/shiki-highlighter-client";
import { supportedHighlightLanguages } from "@/lib/shiki-language-list";

const supported = new Set(supportedHighlightLanguages);

export const streamdownCodePlugin = {
  getSupportedLanguages: () => supportedHighlightLanguages,
  getThemes: () => ["github-light", "github-dark"],
  highlight(
    { code, language }: { code: string; language: string },
    callback?: (result: NonNullable<ReturnType<typeof highlightCode>>) => void,
  ) {
    return highlightCode(code, language, callback);
  },
  name: "shiki",
  supportsLanguage: (language: string) => {
    const key = language.trim().toLowerCase();
    return (
      key === "text" ||
      key === "plaintext" ||
      key === "txt" ||
      key === "plain" ||
      supported.has(key)
    );
  },
  type: "code-highlighter",
} as NonNullable<PluginConfig["code"]>;
