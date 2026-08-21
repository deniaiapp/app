import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { blogPost } from "@/db/schema";

export const BLOG_CACHE_TAG = "blog";

export type ManagedBlogPost = typeof blogPost.$inferSelect;

export async function listPublishedManagedPosts() {
  "use cache";
  cacheTag(BLOG_CACHE_TAG);
  cacheLife("hours");

  return db
    .select()
    .from(blogPost)
    .where(eq(blogPost.status, "published"))
    .orderBy(desc(blogPost.publishedAt), desc(blogPost.updatedAt));
}

export async function getFeaturedPublishedPost() {
  "use cache";
  cacheTag(BLOG_CACHE_TAG);
  cacheLife("hours");

  const [post] = await db
    .select()
    .from(blogPost)
    .where(and(eq(blogPost.status, "published"), eq(blogPost.featured, true)))
    .orderBy(desc(blogPost.publishedAt), desc(blogPost.updatedAt))
    .limit(1);

  return post ?? null;
}

export async function getPublishedManagedPost(slug: string) {
  "use cache";
  cacheTag(BLOG_CACHE_TAG, `${BLOG_CACHE_TAG}:${slug}`);
  cacheLife("hours");

  const [post] = await db
    .select()
    .from(blogPost)
    .where(and(eq(blogPost.slug, slug), eq(blogPost.status, "published")))
    .limit(1);

  return post ?? null;
}

export function pickManagedPostCopy(post: ManagedBlogPost, locale: string) {
  if (locale === "ja" && post.titleJa.trim()) {
    return {
      title: post.titleJa.trim(),
      description: post.descriptionJa.trim() || post.description,
      body: post.bodyJa.trim() || post.body,
    };
  }

  return {
    title: post.title,
    description: post.description,
    body: post.body,
  };
}

export function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}
