import type { TokenizedCode } from "@/lib/shiki-highlighter";

type ShikiHighlighterModule = typeof import("@/lib/shiki-highlighter");

let modulePromise: Promise<ShikiHighlighterModule> | null = null;
let loadedModule: ShikiHighlighterModule | null = null;

function loadShikiHighlighter() {
  modulePromise ??= import("@/lib/shiki-highlighter").then((module) => {
    loadedModule = module;
    return module;
  });
  return modulePromise;
}

export type { TokenizedCode };

export const highlightCode = (
  code: string,
  language: string,
  // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-callbacks)
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null => {
  if (loadedModule) {
    return loadedModule.highlightCode(code, language, callback);
  }

  void loadShikiHighlighter()
    .then((module) => {
      module.highlightCode(code, language, callback);
    })
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
    .catch((error) => {
      console.error("Failed to load syntax highlighting:", error);
    });

  return null;
};
