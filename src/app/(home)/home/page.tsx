import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { HomeFeaturedBadge } from "./home-featured-badge";
import { ClientHome } from "./home-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const description = t(
    "Free multi-model AI chat with GPT, Claude, Gemini, and more in one place.",
  );

  return {
    title: {
      absolute: "Deni AI — Free AI Chat with GPT, Claude & Gemini",
    },
    description,
    alternates: {
      canonical: "https://deniai.app/home",
    },
    openGraph: {
      title: "Deni AI — Free AI Chat with GPT, Claude & Gemini",
      description,
    },
    twitter: {
      title: "Deni AI — Free AI Chat with GPT, Claude & Gemini",
      description,
    },
  };
}

/**
 * JSON-LD needs next-intl (cookies/headers for locale). Keep it behind Suspense
 * so the page shell stays instant under cacheComponents.
 */
async function HomeJsonLd() {
  const t = await getExtracted();
  const webApplicationDescription = t(
    "Access the latest AI models without breaking the bank. Deni AI brings premium intelligence to everyone, completely free.",
  );
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Deni AI",
      url: "https://deniai.app",
      description: webApplicationDescription,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: t("What makes Deni AI different from a single-model chat app?"),
          acceptedAnswer: {
            "@type": "Answer",
            text: t(
              "Deni AI lets people compare and switch between multiple providers in one place so they can choose the model that fits the task.",
            ),
          },
        },
        {
          "@type": "Question",
          name: t("Who is Deni AI for?"),
          acceptedAnswer: {
            "@type": "Answer",
            text: t(
              "Deni AI is for people who use AI repeatedly in real workflows, including developers, founders, students, operators, and teams.",
            ),
          },
        },
        {
          "@type": "Question",
          name: t("Is Deni AI free to try?"),
          acceptedAnswer: {
            "@type": "Answer",
            text: t(
              "Yes. Free access is available with usage limits, and the public site explains features, guides, privacy, and policies before signup.",
            ),
          },
        },
        {
          "@type": "Question",
          name: t("Where can I learn good multi-model habits?"),
          acceptedAnswer: {
            "@type": "Answer",
            text: t(
              "The Blog and AI Guides cover model selection, answer verification, bilingual writing, when not to use AI, and practical multi-model habits.",
            ),
          },
        },
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <HomeJsonLd />
      </Suspense>
      <ClientHome
        featuredBadge={
          <Suspense fallback={null}>
            <HomeFeaturedBadge />
          </Suspense>
        }
      />
    </>
  );
}
