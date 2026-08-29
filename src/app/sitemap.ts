import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog/posts";
import { listPublishedManagedPosts } from "@/lib/blog/queries";
import { changelogEntries } from "@/lib/changelog";
import { PUBLIC_SITE_ORIGIN, publicPages } from "@/lib/public-pages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date("2026-08-16");
  const changelogModified = new Date(changelogEntries[0]?.date ?? lastModified);
  const managedPosts = await listPublishedManagedPosts().catch(() => []);
  const blogEntries = [
    ...managedPosts.map((post) => ({
      url: `${PUBLIC_SITE_ORIGIN}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...blogPosts.map((post) => ({
      url: `${PUBLIC_SITE_ORIGIN}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];

  return [
    ...publicPages.map((page) => ({
      url: page.path === "/" ? PUBLIC_SITE_ORIGIN : `${PUBLIC_SITE_ORIGIN}${page.path}`,
      lastModified: page.path === "/changelog" ? changelogModified : lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...blogEntries,
  ];
}
