import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtracted, getLocale } from "next-intl/server";
import { BlogArticle } from "@/components/content/blog-article";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { createBlogPostingJsonLd, RESERVED_BLOG_SLUGS } from "@/lib/blog/posts";
import { getPublishedManagedPost, pickManagedPostCopy, toIsoDate } from "@/lib/blog/queries";
import { formatAppDate } from "@/lib/format-date";

type BlogSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED_BLOG_SLUGS.has(slug)) {
    return {};
  }

  const post = await getPublishedManagedPost(slug);
  if (!post) {
    return {};
  }

  const locale = await getLocale();
  const copy = pickManagedPostCopy(post, locale);

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `https://deniai.app/blog/${post.slug}`,
    },
    openGraph: {
      title: `${copy.title} — Deni AI Blog`,
      description: copy.description,
    },
  };
}

export default async function ManagedBlogPostPage({ params }: BlogSlugPageProps) {
  const { slug } = await params;
  if (RESERVED_BLOG_SLUGS.has(slug)) {
    notFound();
  }

  const post = await getPublishedManagedPost(slug);
  if (!post) {
    notFound();
  }

  const t = await getExtracted();
  const locale = await getLocale();
  const copy = pickManagedPostCopy(post, locale);
  const date = toIsoDate(post.publishedAt ?? post.createdAt);
  const jsonLd = createBlogPostingJsonLd({
    headline: copy.title,
    description: copy.description,
    slug: post.slug,
    date,
  });

  return (
    <BlogArticle
      breadcrumbLabel={t("Blog")}
      headline={copy.title}
      description={copy.description}
      dateTime={date}
      dateLabel={formatAppDate(date, locale)}
      author={post.author}
      jsonLd={jsonLd}
      nextLinks={[
        { href: "/blog", label: t("Blog") },
        { href: "/guides", label: t("AI Guides") },
      ]}
    >
      <BlogMarkdown markdown={copy.body} />
    </BlogArticle>
  );
}
