import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { GitCompare, MessageSquare, ShieldAlert, Sparkles } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "chatgpt-vs-claude-vs-gemini";
const DATE = "2026-08-14";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("ChatGPT vs Claude vs Gemini: how we pick for daily work");
  const description = t(
    "A practical comparison of ChatGPT, Claude, and Gemini based on task failure modes, not brand loyalty.",
  );

  return {
    title,
    description,
    alternates: {
      canonical: `https://deniai.app/blog/${SLUG}`,
    },
    openGraph: {
      title: `${title} — Deni AI Blog`,
      description,
    },
  };
}

export default async function ChatGptVsClaudeVsGeminiPage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("ChatGPT vs Claude vs Gemini: how we pick for daily work");
  const description = t(
    "We do not pick a permanent winner. We pick the model whose usual failure mode is cheapest to catch for the task in front of us.",
  );

  const profiles = [
    {
      icon: Sparkles,
      title: t("ChatGPT: broad first pass"),
      body: t(
        "We reach for GPT-family models when the task is mixed: a draft, a plan, a rewrite, and a short explanation in one thread. The failure mode to watch is fluent overconfidence on details it did not actually check.",
      ),
    },
    {
      icon: MessageSquare,
      title: t("Claude: long context and careful prose"),
      body: t(
        "We use Claude when the input is a long document, a policy, or a codebase excerpt that needs to stay internally consistent. The failure mode is over-hedging, or a polished answer that still missed a constraint buried in the middle.",
      ),
    },
    {
      icon: GitCompare,
      title: t("Gemini: fast synthesis across messy sources"),
      body: t(
        "Gemini is useful when the job is to gather, cluster, and restate material from several notes or links. The failure mode is blending sources so cleanly that you cannot tell which claim came from where.",
      ),
    },
    {
      icon: ShieldAlert,
      title: t("None of them: high-stakes facts"),
      body: t(
        "For numbers, legal-adjacent claims, medical questions, or anything that will be published as fact, the model is a drafter. The decision happens after a human check against a source outside the chat.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Which model is best overall?"),
      answer: t(
        "There is no best overall model for daily work. ChatGPT, Claude, and Gemini have different failure modes. Pick the one that is cheapest to review for the current task.",
      ),
    },
    {
      question: t("Should I run every prompt through all three?"),
      answer: t(
        "No. Compare models when the output will be published, the task is ambiguous, or a wrong answer creates expensive rework. Otherwise one good first pass is faster.",
      ),
    },
    {
      question: t("Does Deni AI replace ChatGPT, Claude, or Gemini?"),
      answer: t(
        "Deni AI is a workspace for switching between those families without opening three apps. The point is the workflow, not a fourth personality.",
      ),
    },
  ];

  const jsonLd = createBlogPostingJsonLd({
    headline,
    description,
    slug: SLUG,
    date: DATE,
    faqs,
  });

  return (
    <BlogArticle
      breadcrumbLabel={t("Blog")}
      headline={headline}
      description={description}
      dateTime={DATE}
      dateLabel={formatAppDate(DATE, locale)}
      author={t("Deni AI team")}
      jsonLd={jsonLd}
      nextLinks={[
        { href: "/guides/model-selection", label: t("Guide: how to choose a model") },
        { href: "/blog/when-not-to-use-ai", label: t("Next: when not to use AI") },
      ]}
    >
      <GuideSection title={t("Brand loyalty is a weak default")}>
        <p>
          {t(
            "People ask us which model we use. The honest answer is that we use more than one, often in the same afternoon. A writing pass, a code review, and a research summary do not share the same failure cost.",
          )}
        </p>
        <p>
          {t(
            "ChatGPT vs Claude vs Gemini is a useful search because the names are familiar. It is a weak decision framework if you stop at reputation. The stable question is: if this answer is wrong, how will I notice, and how much work does that create?",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={profiles} />

      <GuideSection title={t("How we actually assign the first model")}>
        <p>
          {t(
            "Start with the output you need, not the logo. If you need a messy idea turned into a usable draft, a fast general model is enough. If you need a 20-page brief reduced without losing the exception buried on page 14, long-context discipline matters more than clever phrasing.",
          )}
        </p>
        <p>
          {t(
            "Then name the review step. Code gets tests. A public paragraph gets a source check. A meeting summary gets a scan for invented owners and dates. If you cannot name the review step, you are not ready to pick a model. You are still defining the task.",
          )}
        </p>
        <p>
          {t(
            "Only after that do we compare. In Deni AI we switch models in the same thread when the first answer is plausible but the stakes rose: a draft that will be sent, a patch that will be merged, or a claim that will be repeated to a customer.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("What comparison is for")}>
        <p>
          {t(
            "Running the same vague prompt through three models and ranking the answers by style is entertainment. Useful comparison asks for the same structure: assumptions, unknowns, and the one claim that would change the decision if it were false.",
          )}
        </p>
        <p>
          {t(
            "When two models disagree, do not average them. Isolate the disputed sentence and check it outside the chat. Disagreement is valuable because it points at the exact place a human has to look.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("A one-minute picker")}>
        <GuideList
          items={[
            t("Need a first draft or a rewrite? Start with a fast general model."),
            t("Need to stay faithful to a long document? Prefer a careful long-context model."),
            t("Need to cluster messy notes or several sources? Prefer a synthesis-oriented model."),
            t(
              "Need a fact that will be published? Draft with any model, then verify outside the chat.",
            ),
            t("Need implementation in a real repo? Use a coding-capable model and run the tests."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("What we stopped doing")}>
        <p>
          {t(
            "We stopped treating the newest model as the default for every small task. That habit made simple work slower and trained us to outsource judgment. A cheaper first pass plus a named review step is usually faster end to end.",
          )}
        </p>
        <p>
          {t(
            "We also stopped arguing about which provider is winning the quarter. Those rankings expire. The task profiles do not: draft, analyze, implement, translate, decide. If you can name the profile, the ChatGPT vs Claude vs Gemini question gets smaller.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("Common questions")}>
        {faqs.map((faq) => (
          <div key={faq.question}>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{faq.question}</h3>
            <p className="mt-2">{faq.answer}</p>
          </div>
        ))}
      </GuideSection>
    </BlogArticle>
  );
}
