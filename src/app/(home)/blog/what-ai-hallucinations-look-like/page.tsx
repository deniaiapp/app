import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { BookX, Code2, Scale, Smile } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "what-ai-hallucinations-look-like";
const DATE = "2026-07-18";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("What AI hallucinations look like at work");
  const description = t(
    "The workplace versions of hallucination are quieter than invented facts: fake citations, plausible APIs, and flattened disagreement.",
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

export default async function WhatAiHallucinationsLookLikePage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("What AI hallucinations look like at work");
  const description = t(
    "The textbook example is a made-up fact. The workplace version is a sentence that is almost right, easy to paste, and expensive to unwind later.",
  );

  const shapes = [
    {
      icon: BookX,
      title: t("Citations that almost exist"),
      body: t(
        "A paper title, a docs URL, or a case name that looks like the real one. The first click is the review. If the source does not open, the claim is unverified, no matter how confident the sentence sounded.",
      ),
    },
    {
      icon: Code2,
      title: t("APIs the library never shipped"),
      body: t(
        "A function name that matches the house style, with arguments that feel right. This is the most expensive hallucination in engineering work because it compiles in your head.",
      ),
    },
    {
      icon: Scale,
      title: t("Flattened disagreement"),
      body: t(
        "Two options become a compromise that nobody in the room accepted. The model prefers a tidy ending. Work often needs the conflict left visible.",
      ),
    },
    {
      icon: Smile,
      title: t("Tone that invents a relationship"),
      body: t(
        "An email that thanks a customer for patience they did not show, or an apology for a bug you have not confirmed. Social hallucinations feel polite. They still create commitments.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Are hallucinations just lying?"),
      answer: t(
        "No. The model is completing a pattern. It is not checking a database unless you connected one. Treat fluent text as a draft until a source or a test says otherwise.",
      ),
    },
    {
      question: t("Does a stronger model remove hallucinations?"),
      answer: t(
        "Stronger models reduce some sloppy errors and still invent plausible details. The review step stays. What changes is how often you need a second model to challenge the first.",
      ),
    },
    {
      question: t("How do I catch them faster?"),
      answer: t(
        "Ask for assumptions and unknowns. Click every citation. Run the code. Check names against the attendee list. Hallucinations hide in the parts you are tempted to skip.",
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
        { href: "/guides/verify-ai-answers", label: t("Guide: verify AI answers") },
        { href: "/blog/review-ai-generated-code", label: t("Next: review generated code") },
      ]}
    >
      <GuideSection title={t("The dangerous ones do not look wild")}>
        <p>
          {t(
            "People expect hallucination to announce itself: a city in the wrong country, a law that does not exist. Those are easy. The ones that survive review at work are local and polite.",
          )}
        </p>
        <p>
          {t(
            "In a multi-model workspace we see the same shapes across providers. The wording changes. The failure does not: the model fills a gap with the most typical next sentence.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={shapes} />

      <GuideSection title={t("A work example, not a lab example")}>
        <p>
          {t(
            "You ask for a summary of an incident. The model names a retry budget your service never had, because retry budgets appear in many postmortems. You paste the paragraph into the report. A week later someone tries to change a setting that does not exist.",
          )}
        </p>
        <p>
          {t(
            "Nothing in the prose looked fake. The invented part was a familiar object. That is why “does this sound right?” is a weak check. Ask “where did this object come from?” instead.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("How we force the gap into the open")}>
        <p>
          {t(
            "We ask the model to separate facts, inferences, and guesses. If it cannot point at a source in the pasted material, the line goes in guesses. That single constraint removes a lot of false confidence.",
          )}
        </p>
        <p>
          {t(
            "When two models disagree, we do not pick the nicer paragraph. We extract the disputed claim and check it. Disagreement is a highlight, not a vote.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Review the places hallucinations hide")}>
        <GuideList
          items={[
            t("URLs, paper titles, issue numbers, and “according to” clauses."),
            t("Function names, flags, and config keys that were not in the repo excerpt."),
            t("Owners, dates, and dollar amounts."),
            t("Apologies, promises, and timelines in outbound mail."),
            t("Any sentence that resolves a conflict the source left open."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("What this is not")}>
        <p>
          {t(
            "This is not an argument that AI is unusable. It is an argument that workplace hallucination is a review problem. The verification guide is the longer method. This post is the field guide to what you are looking for.",
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
