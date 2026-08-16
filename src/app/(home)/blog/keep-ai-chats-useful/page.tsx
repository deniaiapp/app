import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { FolderKanban, RotateCcw, Tag, Trash2 } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "keep-ai-chats-useful";
const DATE = "2026-06-12";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("How to keep AI chats useful after the first week");
  const description = t(
    "Chat history becomes landfill unless you treat threads as tasks. A simple system for titles, handoffs, and starting over.",
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

export default async function KeepAiChatsUsefulPage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("How to keep AI chats useful after the first week");
  const description = t(
    "The first chat feels magical. The twentieth is a scroll of half-finished tasks. Usefulness after week one is an organization problem, not a model problem.",
  );

  const habits = [
    {
      icon: Tag,
      title: t("One job per thread"),
      body: t(
        "Name the outcome in the title before you type the first prompt: “Rewrite pricing FAQ” or “Failing login test.” If the job changes, start a new thread. Mixed threads cannot be searched later.",
      ),
    },
    {
      icon: FolderKanban,
      title: t("Park the result outside the chat"),
      body: t(
        "When a draft is good enough, move it to the doc, ticket, or repo that actually owns the work. A chat is a workbench. It is a bad filing cabinet.",
      ),
    },
    {
      icon: RotateCcw,
      title: t("Restart when the model is arguing with old context"),
      body: t(
        "Long threads accumulate stale constraints. If you keep correcting the same assumption, copy the current goal into a new chat. That is cheaper than fighting a ghost requirement from message four.",
      ),
    },
    {
      icon: Trash2,
      title: t("Delete or archive the landfill"),
      body: t(
        "Exploratory chats that went nowhere still clutter the list. Archive them. The cost of keeping every experiment is that you cannot find the one thread you will need on Friday.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Should I keep one long chat for a whole project?"),
      answer: t(
        "No. Keep a project folder if your workspace has one, and give each task its own thread. A project is a container. A thread is a job.",
      ),
    },
    {
      question: t("How do I hand a chat to a teammate?"),
      answer: t(
        "Do not forward a 40-message scroll. Paste the goal, the current draft, and the open questions into a new thread or a ticket. Handoffs need a summary, not a transcript.",
      ),
    },
    {
      question: t("Is search enough to organize chats?"),
      answer: t(
        "Search helps only if titles and first messages contain the real nouns: the feature, the customer, the file. “Help with this” is unsearchable forever.",
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
        { href: "/guides/multi-model-workflows", label: t("Guide: multi-model workflows") },
        { href: "/blog/ai-meeting-notes", label: t("Next: meeting notes") },
      ]}
    >
      <GuideSection title={t("Week one is not the product")}>
        <p>
          {t(
            "Most people judge an AI workspace by the first answer. They should judge it by whether last Tuesday’s work is still findable. That is the point where chat tools start to feel like email: full, and somehow empty.",
          )}
        </p>
        <p>
          {t(
            "We designed Deni AI around switching models in one place. That only stays useful if the thread still represents a single job after you switch. Otherwise the history is just a more expensive notepad.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={habits} />

      <GuideSection title={t("A title is a retrieval tool")}>
        <p>
          {t(
            "Write the title as if you will search for it in two weeks while slightly annoyed. Include the object: the page, the function, the customer segment, the language pair. Do not include how you feel about the task.",
          )}
        </p>
        <p>
          {t(
            "If the workspace can store a project, use it as a shelf, not as one giant conversation. The project holds related threads. Each thread should still stand alone if the others disappear.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("What to save, what to throw away")}>
        <p>
          {t(
            "Save the final draft, the decision, and the prompt that actually worked. Throw away the five failed tones and the tangent about lunch. Those messages train you to reread noise.",
          )}
        </p>
        <p>
          {t(
            "If a prompt is reusable, put the skeleton in a note you control. Do not rely on finding it in chat search. Prompt patterns belong in a short personal library: goal, constraints, output shape, repair step.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Weekly cleanup")}>
        <GuideList
          items={[
            t("Rename any thread still called “New chat.”"),
            t("Move finished drafts out of the workspace into the real system of record."),
            t("Start a new thread for any job that changed direction mid-conversation."),
            t("Archive experiments you will not reopen."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("When the chat is no longer the right surface")}>
        <p>
          {t(
            "If the work is now a checklist, a spec, or a pull request, leave the chat. Continuing to prompt after the artifact exists is how people lose the source of truth. The model can still help later, in a new thread, against the current artifact.",
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
