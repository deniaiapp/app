import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { Ban, Clock, Scale, ShieldAlert } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "when-not-to-use-ai";
const DATE = "2026-08-04";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("When you should not use AI");
  const description = t(
    "The fastest AI workflow is sometimes no AI. A decision guide for tasks where a model adds risk, rework, or false confidence.",
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

export default async function WhenNotToUseAiPage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("When you should not use AI");
  const description = t(
    "The useful question is not whether AI can produce an answer. It is whether the answer will be cheaper to trust than doing the work yourself.",
  );

  const stopCases = [
    {
      icon: ShieldAlert,
      title: t("The cost of being wrong is immediate"),
      body: t(
        "Safety, legal, medical, financial, and production-access work still needs a qualified human and a source of truth. A fluent draft can hide the fact that nobody checked.",
      ),
    },
    {
      icon: Ban,
      title: t("You cannot name the review step"),
      body: t(
        "If you do not know how you will check the output, you are not using a tool. You are hoping. Skip the model until the check is obvious: a test, a document, a calculator, or a person.",
      ),
    },
    {
      icon: Clock,
      title: t("The task is already faster by hand"),
      body: t(
        "Renaming one variable, sending a two-line reply, or looking up a value you already know often takes longer once you write a prompt, wait, and edit the result.",
      ),
    },
    {
      icon: Scale,
      title: t("The material should not leave your head"),
      body: t(
        "Secrets, credentials, unreleased security findings, and confidential personal data do not belong in a consumer chat, even when the product says it will not train on your conversations.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Is it anti-AI to skip the model?"),
      answer: t(
        "No. Skipping AI is part of using it well. The goal is a trustworthy next step, not a transcript that proves you used a model.",
      ),
    },
    {
      question: t("What should I do instead of prompting?"),
      answer: t(
        "Do the small task by hand, look up the source, write the first ugly draft yourself, or ask a person who owns the decision. Use AI after the problem is small enough to review.",
      ),
    },
    {
      question: t("Does Deni AI encourage people not to use the product?"),
      answer: t(
        "We would rather people use the workspace for tasks it can actually help with. A bloated chat full of unverified answers is not a successful session.",
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
        { href: "/guides/privacy-when-using-ai", label: t("Guide: privacy habits") },
        {
          href: "/blog/what-ai-hallucinations-look-like",
          label: t("Next: workplace hallucinations"),
        },
      ]}
    >
      <GuideSection title={t("AI is optional even when it is available")}>
        <p>
          {t(
            "We build a multi-model chat product, so it would be easy to pretend every task belongs in a prompt box. That is not how we work, and it is not how we want visitors to work.",
          )}
        </p>
        <p>
          {t(
            "The hidden cost of AI is not the token bill. It is the time spent reading a plausible answer that you still have to rebuild, plus the social pressure to accept something that looks finished.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={stopCases} />

      <GuideSection title={t("The ten-minute test")}>
        <p>
          {t(
            "If you can finish the task in ten minutes without a model, do that. Prompting, waiting, and editing often consume the same ten minutes and leave you less sure than if you had written the first version yourself.",
          )}
        </p>
        <p>
          {t(
            "Use AI when the first ten minutes would be spent on boilerplate: outlining a long email, clustering messy notes, generating practice questions, or proposing a patch you will immediately run.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("Tasks that look like AI work and are not")}>
        <p>
          {t(
            "Deciding a price, accepting a legal interpretation, or closing an incident from a generated summary. Those are judgment tasks. A model can list options. It cannot own the consequence.",
          )}
        </p>
        <p>
          {t(
            "Remembering something you should retrieve yourself. Students and professionals both lose the plot when they ask a model to hold the structure of an argument they have not practiced. If the point of the work is that you can recall it later, do the recall.",
          )}
        </p>
        <p>
          {t(
            "Filling a blank page when you have not decided the audience. A model will invent a tone. You will then spend longer removing that tone than you would have spent writing a blunt first paragraph.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Skip the model when")}>
        <GuideList
          items={[
            t("You cannot describe how you will verify the answer."),
            t("The material includes secrets, credentials, or confidential personal data."),
            t("A wrong answer would ship, publish, or spend money immediately."),
            t("You already know the two-sentence reply."),
            t("The real blocker is a decision, not missing text."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("What we do instead")}>
        <p>
          {t(
            "We write the ugly first sentence, look up the source, or ask the person who owns the decision. Then, if the remaining work is mechanical, we open a chat. That order keeps the model in the part of the job it is good at: expansion, contrast, and cleanup.",
          )}
        </p>
        <p>
          {t(
            "If you want a longer method for the cases where AI is appropriate, read the verification guide and the privacy guide. Those pages assume you already decided the task belongs in a chat.",
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
