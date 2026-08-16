import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { KeyRound, Receipt, Shuffle, Users } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "platform-vs-own-api-key";
const DATE = "2026-06-28";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("Platform credits vs your own API key");
  const description = t(
    "Two cost models for multi-model chat. When a workspace should pay the bill, and when bringing your own key is cheaper and clearer.",
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

export default async function PlatformVsOwnApiKeyPage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("Platform credits vs your own API key");
  const description = t(
    "This is not a moral choice. It is a bookkeeping choice: who sees the invoice, who sets the limit, and how often you switch models.",
  );

  const cases = [
    {
      icon: Receipt,
      title: t("Use platform credits when the work is mixed and bursty"),
      body: t(
        "A student, a founder, or a small team that hops between writing, research, and light coding usually wants one bill and a visible limit. Paying three providers to try a model is a worse first week.",
      ),
    },
    {
      icon: KeyRound,
      title: t("Bring your own key when spend is already concentrated"),
      body: t(
        "If you already buy a large amount of one provider, keep that invoice where finance can see it. A workspace should not launder a cost center you already understand.",
      ),
    },
    {
      icon: Shuffle,
      title: t("Switching models has a hidden cost"),
      body: t(
        "Retries, long context, and “just one more comparison” are where bills jump. Platform limits make that visible. A raw key with no budget alarm does not.",
      ),
    },
    {
      icon: Users,
      title: t("Teams need a shared default"),
      body: t(
        "If five people each paste a personal key, you lose usage visibility. Pick one default for shared work. Keep personal keys for experiments that should not hit the team invoice.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Is bringing your own key more private?"),
      answer: t(
        "It changes who processes the request, not whether the text leaves your machine. Read the privacy policy of both the workspace and the provider. Do not paste secrets in either case.",
      ),
    },
    {
      question: t("Can I mix platform credits and my own key?"),
      answer: t(
        "Yes. That is the usual setup: platform access for everyday models, a personal or company key for a high-volume provider you already pay.",
      ),
    },
    {
      question: t("When is a paid plan worth it?"),
      answer: t(
        "When you hit the free limit on work you already review, or when you need higher-cost models often enough that juggling extra apps is the real expense.",
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
        { href: "/guides/free-ai-chat", label: t("Guide: choose a free workspace") },
        { href: "/blog/keep-ai-chats-useful", label: t("Next: keep chats useful") },
      ]}
    >
      <GuideSection title={t("Two invoices, two different jobs")}>
        <p>
          {t(
            "A multi-model workspace can pay providers for you, or it can send your request with a key you already own. People treat that as a purity test. It is closer to choosing between a transit card and reimbursing each ride.",
          )}
        </p>
        <p>
          {t(
            "Platform credits buy convenience and a single limit. Your own API key buys continuity with a provider relationship you already have. Both are valid. Mixing them is often the adult setup.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={cases} />

      <GuideSection title={t("The costs people forget to count")}>
        <p>
          {t(
            "Context windows. A cheap model with a huge paste can cost more than a stronger model with a short excerpt. If you dump the whole repo into every prompt, the key vs credit debate is the wrong debate.",
          )}
        </p>
        <p>
          {t(
            "Comparisons. Three models on one ambiguous prompt can be cheaper than one bad merge. They can also be three times the spend for a style contest. Decide before you run the extra calls whether disagreement would change the next step.",
          )}
        </p>
        <p>
          {t(
            "Abandoned threads. Long chats that nobody will reread are inventory you already paid for. Starting a new thread for a new task is a cost control, not only a hygiene habit.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Pick the bill that matches the work")}>
        <GuideList
          items={[
            t("Exploring several model families this week? Use platform credits."),
            t("One provider already has your procurement process? Use that key."),
            t("Shared team work needs a usage view? Do not scatter personal keys."),
            t("High-risk text should not go out at all, regardless of who pays."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("How Deni AI treats this")}>
        <p>
          {t(
            "Deni AI is built so people can start on platform access, then attach their own keys when they already pay a provider. The interface should stay the same. The invoice should be the only thing that moves.",
          )}
        </p>
        <p>
          {t(
            "If you are still choosing a free workspace at all, read the buyer-style guide. Limits, model flexibility, and public policy pages matter more than the logo on the first screen.",
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
