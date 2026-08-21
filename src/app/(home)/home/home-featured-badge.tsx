import { getExtracted, getLocale } from "next-intl/server";
import { getBlogPostPath } from "@/lib/blog/posts";
import { getFeaturedPublishedPost, pickManagedPostCopy } from "@/lib/blog/queries";
import { HomeFeaturedBadgeLink } from "./home-featured-badge-link";

export async function HomeFeaturedBadge() {
  const post = await getFeaturedPublishedPost();
  if (!post) {
    return null;
  }

  const locale = await getLocale();
  const t = await getExtracted();
  const copy = pickManagedPostCopy(post, locale);

  return (
    <HomeFeaturedBadgeLink
      href={getBlogPostPath(post.slug)}
      label={t("Featured")}
      title={copy.title}
    />
  );
}
