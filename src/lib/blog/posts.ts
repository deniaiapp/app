export const BLOG_ORIGIN = "https://deniai.app";

export const blogPosts = [
  {
    slug: "chatgpt-vs-claude-vs-gemini",
    date: "2026-08-14",
    title: "ChatGPT vs Claude vs Gemini: how we pick for daily work",
    description:
      "A practical comparison of ChatGPT, Claude, and Gemini based on task failure modes, not brand loyalty.",
  },
  {
    slug: "ai-for-bilingual-writing",
    date: "2026-08-08",
    title: "Using AI for bilingual writing without sounding like a machine",
    description:
      "A two-pass workflow for English and Japanese drafts that keeps meaning, tone, and audience fit under human control.",
  },
  {
    slug: "when-not-to-use-ai",
    date: "2026-08-04",
    title: "When you should not use AI",
    description:
      "The fastest AI workflow is sometimes no AI. A decision guide for tasks where a model adds risk, rework, or false confidence.",
  },
  {
    slug: "ai-meeting-notes",
    date: "2026-07-24",
    title: "How to turn messy meeting notes into decisions with AI",
    description:
      "A capture-and-synthesis method that turns scattered notes into owners, dates, and open questions you can actually use.",
  },
  {
    slug: "what-ai-hallucinations-look-like",
    date: "2026-07-18",
    title: "What AI hallucinations look like at work",
    description:
      "The workplace versions of hallucination are quieter than invented facts: fake citations, plausible APIs, and flattened disagreement.",
  },
  {
    slug: "review-ai-generated-code",
    date: "2026-07-10",
    title: "How to review AI-generated code before you merge it",
    description:
      "A review checklist for AI patches: file boundaries, tests, invented APIs, and the moment you should throw the draft away.",
  },
  {
    slug: "platform-vs-own-api-key",
    date: "2026-06-28",
    title: "Platform credits vs your own API key",
    description:
      "Two cost models for multi-model chat. When a workspace should pay the bill, and when bringing your own key is cheaper and clearer.",
  },
  {
    slug: "keep-ai-chats-useful",
    date: "2026-06-12",
    title: "How to keep AI chats useful after the first week",
    description:
      "Chat history becomes landfill unless you treat threads as tasks. A simple system for titles, handoffs, and starting over.",
  },
] as const;

export type BlogPostMeta = (typeof blogPosts)[number];

export const RESERVED_BLOG_SLUGS = new Set<string>([
  "rss.xml",
  "new",
  ...blogPosts.map((post) => post.slug),
]);

export function getBlogPostPath(slug: string) {
  return `/blog/${slug}`;
}

export function getBlogPostUrl(slug: string) {
  return `${BLOG_ORIGIN}${getBlogPostPath(slug)}`;
}

export function createBlogPostingJsonLd({
  headline,
  description,
  slug,
  date,
  faqs = [],
}: {
  headline: string;
  description: string;
  slug: string;
  date: string;
  faqs?: Array<{ question: string; answer: string }>;
}) {
  const url = getBlogPostUrl(slug);
  const posting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    datePublished: date,
    dateModified: date,
    author: {
      "@type": "Organization",
      name: "Deni AI",
      url: BLOG_ORIGIN,
    },
    publisher: {
      "@type": "Organization",
      name: "Deni AI",
      url: BLOG_ORIGIN,
      logo: {
        "@type": "ImageObject",
        url: `${BLOG_ORIGIN}/og.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
  };

  if (faqs.length === 0) {
    return posting;
  }

  return [
    posting,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ];
}
