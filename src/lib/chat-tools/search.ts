import { createGroq } from "@ai-sdk/groq";
import { generateText, tool } from "ai";
import { z } from "zod";
import { env } from "@/env";
import { fetchPageText } from "./fetch-page";
import type { SearchResult } from "./types";

type ExaSearchResponse = {
  results?: Array<{
    title: string;
    url: string;
    text?: string;
    highlights?: string[];
  }>;
};

export function createSearchTool() {
  return tool({
    description:
      "Search the web and get short page summaries. Prefer the browse tool when you need the full content of a specific URL.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Search query"),
      amount: z
        .number()
        .int()
        .min(5)
        .max(15)
        .optional()
        .describe("Number of search pages (min 5, max 15)"),
    }),
    execute: async ({ query, amount }, { abortSignal }) => {
      const maxResults = Math.min(Math.max(amount ?? 10, 5), 15);
      try {
        const EXA_API_KEY = env.EXA_API_KEY;
        if (!EXA_API_KEY) {
          throw new Error("Exa API key not configured");
        }

        const response = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-api-key": EXA_API_KEY,
          },
          body: JSON.stringify({
            query,
            numResults: maxResults,
            type: "fast",
            contents: {
              highlights: {
                query,
                maxCharacters: 2000,
              },
            },
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(`Exa Search API error: ${response.status}`);
        }

        const data = (await response.json()) as ExaSearchResponse;
        const results: SearchResult[] = (data.results ?? []).map((item) => ({
          title: item.title,
          url: item.url,
          description: item.highlights?.join("\n\n") || item.text?.slice(0, 500) || "",
        }));

        const groqApiKey = env.GROQ_API_KEY?.trim();
        if (!groqApiKey) {
          return results.map((result) => ({ ...result, summary: result.description }));
        }

        // Fetch and summarize each page
        const summarizer = createGroq({ apiKey: groqApiKey })("openai/gpt-oss-20b");
        const summarizedResults = await Promise.all(
          results.map(async (result) => {
            try {
              const page = await fetchPageText(result.url, {
                maxChars: 8000,
                signal: abortSignal,
                // Keep search latency down; browse tool owns reader fallback.
                allowReaderFallback: false,
              });

              if (!page.content) {
                return { ...result, summary: result.description };
              }

              const { text: summary } = await generateText({
                model: summarizer,
                prompt: `Summarize the following webpage content detailed:\n\n${page.content}`,
                maxOutputTokens: 2000,
                abortSignal,
              });

              return { ...result, summary: summary.trim() };
            } catch (error) {
              console.error(`Failed to summarize ${result.url}:`, error);
              return { ...result, summary: result.description };
            }
          }),
        );

        return summarizedResults;
      } catch (error) {
        console.error("Search tool error:", error);
        throw new Error("Web search failed. Please try again later.");
      }
    },
  });
}
