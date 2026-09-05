import { createBundledHighlighter, type HighlighterGeneric, type ThemedToken } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * Curated Shiki grammars used in chat. Importing `shiki` / `@streamdown/code`
 * pulls every bundled language as a separate async chunk and dominates
 * `next build` compile time.
 *
 * C++ intentionally reuses the C grammar below. Shiki's C++ grammar pulls a
 * very large embedded grammar chunk; C still gives C++ fences useful token
 * coloring without making every production build parse that extra module.
 */
const bundledLangs = {
  astro: () => import("@shikijs/langs/astro"),
  c: () => import("@shikijs/langs/c"),
  csharp: () => import("@shikijs/langs/csharp"),
  css: () => import("@shikijs/langs/css"),
  dart: () => import("@shikijs/langs/dart"),
  diff: () => import("@shikijs/langs/diff"),
  docker: () => import("@shikijs/langs/docker"),
  elixir: () => import("@shikijs/langs/elixir"),
  go: () => import("@shikijs/langs/go"),
  graphql: () => import("@shikijs/langs/graphql"),
  html: () => import("@shikijs/langs/html"),
  java: () => import("@shikijs/langs/java"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  jsx: () => import("@shikijs/langs/jsx"),
  kotlin: () => import("@shikijs/langs/kotlin"),
  lua: () => import("@shikijs/langs/lua"),
  markdown: () => import("@shikijs/langs/markdown"),
  php: () => import("@shikijs/langs/php"),
  powershell: () => import("@shikijs/langs/powershell"),
  prisma: () => import("@shikijs/langs/prisma"),
  protobuf: () => import("@shikijs/langs/protobuf"),
  python: () => import("@shikijs/langs/python"),
  ruby: () => import("@shikijs/langs/ruby"),
  rust: () => import("@shikijs/langs/rust"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  sql: () => import("@shikijs/langs/sql"),
  svelte: () => import("@shikijs/langs/svelte"),
  swift: () => import("@shikijs/langs/swift"),
  toml: () => import("@shikijs/langs/toml"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  vue: () => import("@shikijs/langs/vue"),
  xml: () => import("@shikijs/langs/xml"),
  yaml: () => import("@shikijs/langs/yaml"),
  zig: () => import("@shikijs/langs/zig"),
} as const;

type AppLang = keyof typeof bundledLangs;
type AppTheme = "github-dark" | "github-light";

const langAlias = {
  bash: "shellscript",
  "c++": "c",
  cmd: "powershell",
  cs: "csharp",
  cpp: "c",
  dockerfile: "docker",
  gql: "graphql",
  js: "javascript",
  kt: "kotlin",
  md: "markdown",
  proto: "protobuf",
  ps1: "powershell",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "shellscript",
  shell: "shellscript",
  ts: "typescript",
  yml: "yaml",
  zsh: "shellscript",
} as const satisfies Record<string, AppLang>;

const SPECIAL_LANGS = new Set(["ansi", "plain", "plaintext", "text", "txt"]);

const createHighlighter = createBundledHighlighter<AppLang, AppTheme>({
  engine: () => createJavaScriptRegexEngine({ forgiving: true }),
  langs: bundledLangs,
  themes: {
    "github-dark": () => import("@shikijs/themes/github-dark"),
    "github-light": () => import("@shikijs/themes/github-light"),
  },
});

export type TokenizedCode = {
  bg: string;
  fg: string;
  tokens: ThemedToken[][];
};

const tokensCache = new Map<string, TokenizedCode>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

let highlighterPromise: Promise<HighlighterGeneric<AppLang, AppTheme>> | null = null;

const getCore = () => {
  highlighterPromise ??= createHighlighter({
    langAlias,
    langs: [],
    themes: ["github-light", "github-dark"],
  });
  return highlighterPromise;
};

const resolveLang = (language: string): AppLang | "text" => {
  const key = language.trim().toLowerCase();
  if (!key || SPECIAL_LANGS.has(key)) {
    return "text";
  }
  if (key in bundledLangs) {
    return key as AppLang;
  }
  if (key in langAlias) {
    return langAlias[key as keyof typeof langAlias];
  }
  return "text";
};

const getTokensCacheKey = (code: string, language: string) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";
  return `${language}:${code.length}:${start}:${end}`;
};

const getHighlighter = async (language: string) => {
  const highlighter = await getCore();
  const lang = resolveLang(language);
  if (lang !== "text") {
    const loaded = highlighter.getLoadedLanguages();
    if (!loaded.includes(lang)) {
      await highlighter.loadLanguage(lang);
    }
  }
  return { highlighter, lang };
};

export const highlightCode = (
  code: string,
  language: string,
  // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-callbacks)
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null => {
  const tokensCacheKey = getTokensCacheKey(code, language);
  const cached = tokensCache.get(tokensCacheKey);
  if (cached) {
    return cached;
  }

  if (callback) {
    if (!subscribers.has(tokensCacheKey)) {
      subscribers.set(tokensCacheKey, new Set());
    }
    subscribers.get(tokensCacheKey)?.add(callback);
  }

  getHighlighter(language)
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
    .then(({ highlighter, lang }) => {
      const result = highlighter.codeToTokens(code, {
        lang,
        themes: {
          dark: "github-dark",
          light: "github-light",
        },
      });

      const tokenized: TokenizedCode = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      };

      tokensCache.set(tokensCacheKey, tokenized);

      const subs = subscribers.get(tokensCacheKey);
      if (subs) {
        for (const sub of subs) {
          sub(tokenized);
        }
        subscribers.delete(tokensCacheKey);
      }
    })
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then), eslint-plugin-promise(prefer-await-to-callbacks)
    .catch((error) => {
      console.error("Failed to highlight code:", error);
      subscribers.delete(tokensCacheKey);
    });

  return null;
};
