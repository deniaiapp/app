import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { Languages, ListChecks, PenLine, Users } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "ai-for-bilingual-writing";
const DATE = "2026-08-08";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("Using AI for bilingual writing without sounding like a machine");
  const description = t(
    "A two-pass workflow for English and Japanese drafts that keeps meaning, tone, and audience fit under human control.",
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

export default async function AiForBilingualWritingPage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("Using AI for bilingual writing without sounding like a machine");
  const description = t(
    "Literal accuracy is the first pass, not the last. A bilingual draft fails when it is correct and still sounds like nobody would say it.",
  );

  const passes = [
    {
      icon: Languages,
      title: t("Pass one: meaning"),
      body: t(
        "Ask the model to preserve claims, numbers, names, and constraints. Tell it not to improve the argument yet. The job is transfer, not rewrite.",
      ),
    },
    {
      icon: PenLine,
      title: t("Pass two: voice"),
      body: t(
        "In a second prompt, ask only for tone: shorter sentences, natural particles, fewer nominalizations, or a less salesy English rhythm. Do not let it reopen the facts.",
      ),
    },
    {
      icon: Users,
      title: t("Pass three: a real reader"),
      body: t(
        "Read the result as the person who will receive it. If a phrase would feel stiff in Slack or too casual in a contract, fix that yourself. Models average the internet. Your audience is not the internet.",
      ),
    },
    {
      icon: ListChecks,
      title: t("Keep a do-not-translate list"),
      body: t(
        "Product names, legal defined terms, and error strings often should stay in the source language. Put those in the prompt so the model does not invent a local equivalent.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Can I translate a whole site in one prompt?"),
      answer: t(
        "You can draft it that way. You should not ship it that way. Split by page purpose: UI chrome, legal text, and marketing copy fail in different ways.",
      ),
    },
    {
      question: t("Is Japanese to English harder than English to Japanese?"),
      answer: t(
        "They fail differently. English often gets too long and explanatory. Japanese often gets too stiff or too casual for the relationship. Review for the failure you actually see.",
      ),
    },
    {
      question: t("Should I use the same model for both languages?"),
      answer: t(
        "Use whatever model handles the source text faithfully, then do a voice pass. If two models disagree on a claim, check the source sentence instead of blending the translations.",
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
        { href: "/guides/prompt-patterns", label: t("Guide: prompt patterns") },
        { href: "/blog/chatgpt-vs-claude-vs-gemini", label: t("Next: how we pick models") },
      ]}
    >
      <GuideSection title={t("Why bilingual drafts still need a human")}>
        <p>
          {t(
            "Deni AI ships in English and Japanese, so we see the same machine-voice problems visitors see. A model can move meaning across languages quickly. It is much worse at deciding how close the reader is, how much explanation they need, and which words should stay untranslated.",
          )}
        </p>
        <p>
          {t(
            "The tell is not a grammar error. It is a sentence that is technically right and socially wrong: an English paragraph that explains what the Japanese never said, or a Japanese sentence that sounds like a translated press release.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={passes} />

      <GuideSection title={t("Failures we keep seeing")}>
        <p>
          {t(
            "Over-explaining. English drafts often add a helpful clause that was never in the Japanese. That extra clause can change a promise. If the source did not say it, the translation should not say it.",
          )}
        </p>
        <p>
          {t(
            "Register mismatch. A model will happily turn a blunt internal note into polite customer copy, or the reverse. Tell it the relationship: teammate, customer, lawyer, or public reader.",
          )}
        </p>
        <p>
          {t(
            "False friends in product language. Words like agent, memory, workspace, and free plan do not have one perfect pair. We keep a glossary and force the model to use it. Without that, every page slowly drifts.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Prompt skeleton we reuse")}>
        <GuideList
          items={[
            t("Audience and relationship: who reads this, and how formal should it sound?"),
            t("Do-not-translate list: product names, legal terms, and error strings."),
            t("Preserve: numbers, dates, claims, and anything that looks like a promise."),
            t("Do not add explanations that are missing from the source."),
            t("After the meaning pass, run a second prompt that may change rhythm only."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("When to stop using the model")}>
        <p>
          {t(
            "Legal pages, commercial disclosure, and anything that creates a customer obligation should be reviewed by a person who can read both languages. AI can propose a first pass. It cannot sign the policy.",
          )}
        </p>
        <p>
          {t(
            "If a sentence is doing social work — an apology, a refusal, a joke — write it yourself. Those sentences are short. The risk of a wrong tone is higher than the time you save.",
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
