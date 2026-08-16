import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { FileWarning, Play, ShieldAlert, Trash2 } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "review-ai-generated-code";
const DATE = "2026-07-10";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("How to review AI-generated code before you merge it");
  const description = t(
    "A review checklist for AI patches: file boundaries, tests, invented APIs, and the moment you should throw the draft away.",
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

export default async function ReviewAiGeneratedCodePage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("How to review AI-generated code before you merge it");
  const description = t(
    "Fluent code is not correct code. An AI patch is a suggestion that still has to survive the same review you would give a rushed teammate.",
  );

  const checks = [
    {
      icon: FileWarning,
      title: t("Did it touch the right files?"),
      body: t(
        "Ask the model to name files before it writes a patch. If the answer wanders into unrelated modules, treat the whole draft as a sketch. Scope errors are cheaper to catch than logic errors.",
      ),
    },
    {
      icon: Play,
      title: t("Can you run it immediately?"),
      body: t(
        "If you cannot paste the change and run tests, types, or the app, you do not have a patch. You have a description of a patch. Do not review prose as if it were a diff.",
      ),
    },
    {
      icon: ShieldAlert,
      title: t("What did it invent?"),
      body: t(
        "Scan for new helpers, flags, env vars, and endpoints that were not in the excerpt you pasted. Invented APIs are the default failure mode of coding models, not a rare bug.",
      ),
    },
    {
      icon: Trash2,
      title: t("Is it faster to rewrite?"),
      body: t(
        "If the draft fights the existing style, ignores tests, or requires a paragraph of cleanup per file, throw it away. Keeping a bad AI patch out of loyalty wastes more time than starting from the failing test.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Should I ask the model to write the tests too?"),
      answer: t(
        "You can. Then run them. Tests generated with the same guess can share the same blind spot. Prefer a test you understand over a green suite you cannot explain.",
      ),
    },
    {
      question: t("Is a coding model enough, or do I need a second model?"),
      answer: t(
        "Use a coding-capable model for the first patch. Bring a second model only when the task is ambiguous or the first answer cannot name its constraints. Running two models does not replace running the code.",
      ),
    },
    {
      question: t("When is AI code not worth reviewing?"),
      answer: t(
        "When you cannot describe the expected behavior, or when the change is one line you already know. Review cost should not exceed the cost of writing it yourself.",
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
        {
          href: "/blog/what-ai-hallucinations-look-like",
          label: t("Next: workplace hallucinations"),
        },
      ]}
    >
      <GuideSection title={t("Review the patch, not the confidence")}>
        <p>
          {t(
            "AI-generated code often arrives with comments, a migration plan, and a calm explanation of why the change is safe. That packaging is not evidence. The evidence is a diff you can run.",
          )}
        </p>
        <p>
          {t(
            "We treat generated patches the way we treat a pull request from someone who has never seen the repo: assume they guessed the boundaries, then prove otherwise.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={checks} />

      <GuideSection title={t("A review order that stays cheap")}>
        <p>
          {t(
            "First, confirm the intended behavior in one sentence. If you and the model do not share that sentence, stop. Prompting for more code will only decorate the misunderstanding.",
          )}
        </p>
        <p>
          {t(
            "Second, look at file list and public API. A good patch is boring: it changes the smallest surface that can carry the behavior. A bad patch refactors neighbors to make the new idea fit.",
          )}
        </p>
        <p>
          {t(
            "Third, run the smallest check that can fail: a unit test, a typecheck, or the one screen the change affects. Reading without running is how invented helpers survive.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("Security is not a later pass")}>
        <p>
          {t(
            "Watch for new network calls, loosened auth checks, logged secrets, and copy-pasted snippets that pull in a dependency you did not ask for. Models optimize for “it works in the story,” not for your threat model.",
          )}
        </p>
        <p>
          {t(
            "If the task touches auth, billing, or user data, the human review is the product. The model can propose a patch. It cannot accept the risk.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Merge checklist")}>
        <GuideList
          items={[
            t("The behavior is stated in one sentence you agree with."),
            t("The file list is small and named before the patch."),
            t("No new API, flag, or env var appeared without a source in the repo."),
            t("Tests or a manual path were run, not only described."),
            t("You would still understand the change if the chat disappeared tomorrow."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("How this fits a multi-model workspace")}>
        <p>
          {t(
            "In Deni AI we start with a coding-capable model, then switch only if the first answer cannot explain its constraints. The workspace is for that switch. It is not a substitute for the typechecker.",
          )}
        </p>
        <p>
          {t(
            "If you want the broader verification method for facts and citations, not only code, use the verify-AI-answers guide. The habits are the same: name the failure, then check it outside the chat.",
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
