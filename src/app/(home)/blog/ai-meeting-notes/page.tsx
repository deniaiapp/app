import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { CalendarCheck, ListTodo, Shield, Users } from "lucide-react";
import { BlogArticle } from "@/components/content/blog-article";
import {
  GuideCallout,
  GuideCardGrid,
  GuideList,
  GuideSection,
} from "@/components/content/guide-article";
import { createBlogPostingJsonLd } from "@/lib/blog/posts";
import { formatAppDate } from "@/lib/format-date";

const SLUG = "ai-meeting-notes";
const DATE = "2026-07-24";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const title = t("How to turn messy meeting notes into decisions with AI");
  const description = t(
    "A capture-and-synthesis method that turns scattered notes into owners, dates, and open questions you can actually use.",
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

export default async function AiMeetingNotesPage() {
  const t = await getExtracted();
  const locale = await getLocale();
  const headline = t("How to turn messy meeting notes into decisions with AI");
  const description = t(
    "A summary that nobody acts on is just a cleaner pile of words. The useful output of meeting notes is a decision, an owner, and a date.",
  );

  const stages = [
    {
      icon: Users,
      title: t("Capture ugly, not complete"),
      body: t(
        "During the meeting, write fragments: names, numbers, disagreements, and anything that sounded like a commitment. Do not ask a model to invent the meeting you failed to attend.",
      ),
    },
    {
      icon: ListTodo,
      title: t("Ask for decisions, not a recap"),
      body: t(
        "Prompt for three lists only: decisions, open questions, and actions with owners. If the model cannot find an owner, it must leave the line marked unknown instead of assigning someone.",
      ),
    },
    {
      icon: CalendarCheck,
      title: t("Verify dates and names"),
      body: t(
        "Models fill gaps with plausible Tuesdays and familiar teammates. Check every date and owner against your calendar and the attendee list before the note becomes the record.",
      ),
    },
    {
      icon: Shield,
      title: t("Redact before you paste"),
      body: t(
        "Customer names, salaries, health details, and access credentials do not belong in a chat. Replace them with roles or initials if the structure is what you need.",
      ),
    },
  ];

  const faqs = [
    {
      question: t("Can AI replace a meeting note-taker?"),
      answer: t(
        "It can turn fragments into a structured draft. Someone who was in the room still has to confirm what was actually decided.",
      ),
    },
    {
      question: t("Should I paste a full transcript?"),
      answer: t(
        "Only if the transcript is already allowed to leave the meeting tool and you have removed secrets. A short list of raw notes is often enough and safer.",
      ),
    },
    {
      question: t("What if the model invents an action item?"),
      answer: t(
        "Treat any action without a quoted source in your notes as unconfirmed. Delete it or mark it as a question. Do not publish invented work.",
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
        { href: "/blog/keep-ai-chats-useful", label: t("Next: keep chats useful") },
      ]}
    >
      <GuideSection title={t("Notes fail when they only describe the hour")}>
        <p>
          {t(
            "We see the same pattern in our own work: someone pastes a transcript, asks for a summary, and receives a polite paragraph that could apply to any meeting. Nobody can tell what changed.",
          )}
        </p>
        <p>
          {t(
            "AI meeting notes are useful when they extract the parts that create work: a decision, a disagreement that was left open, and an action with a name. Everything else is atmosphere.",
          )}
        </p>
      </GuideSection>

      <GuideCardGrid items={stages} />

      <GuideSection title={t("The prompt we actually use")}>
        <p>
          {t(
            "We ask for four headings and nothing else: Decisions, Actions, Open questions, and Claims that need a source. Under Actions, every line must have an owner and a date, or the word unknown.",
          )}
        </p>
        <p>
          {t(
            "We also say: do not invent attendees, do not turn a maybe into a plan, and quote the fragment from the notes if a decision is unclear. That last instruction is the one that stops the model from sounding sure.",
          )}
        </p>
      </GuideSection>

      <GuideSection title={t("How false confidence shows up")}>
        <p>
          {t(
            "A model will turn “we should look at pricing later” into “Pricing review scheduled for Friday.” It will assign the quietest person in the notes as the owner because that name appeared nearby. These are not random errors. They are the model completing a template.",
          )}
        </p>
        <p>
          {t(
            "Your review is therefore not literary. Scan owners, dates, and any sentence that sounds more decisive than the meeting felt. If you were not in the room, send the draft to someone who was before it becomes the official note.",
          )}
        </p>
      </GuideSection>

      <GuideCallout title={t("Do not paste")}>
        <GuideList
          items={[
            t(
              "Customer records, health details, or anything covered by a confidentiality agreement.",
            ),
            t("Passwords, tokens, or private meeting links."),
            t("Compensation, performance, or disciplinary discussion."),
            t("A transcript you are not allowed to export from the meeting tool."),
          ]}
        />
      </GuideCallout>

      <GuideSection title={t("When the notes are done")}>
        <p>
          {t(
            "Move the confirmed actions into the tracker your team already uses. Do not leave them inside a chat thread. A chat is a drafting surface. It is a bad system of record.",
          )}
        </p>
        <p>
          {t(
            "If you want a reusable skeleton for this kind of structured output, the prompt patterns guide covers goals, constraints, and repair loops that transfer between models.",
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
