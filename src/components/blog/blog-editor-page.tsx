"use client";

import { ArrowLeft, Eye, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { slugifyBlogTitle } from "@/lib/blog/slug";
import { trpc } from "@/lib/trpc/react";

type DraftState = {
  slug: string;
  title: string;
  description: string;
  body: string;
  titleJa: string;
  descriptionJa: string;
  bodyJa: string;
  author: string;
};

const EMPTY_DRAFT: DraftState = {
  slug: "",
  title: "",
  description: "",
  body: "",
  titleJa: "",
  descriptionJa: "",
  bodyJa: "",
  author: "Deni AI team",
};

export function BlogEditorPage({ postId }: { postId?: string }) {
  const t = useExtracted();
  const router = useRouter();
  const utils = trpc.useUtils();
  const isNew = !postId;
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [localeTab, setLocaleTab] = useState("en");
  const [mode, setMode] = useState("write");

  const canManage = trpc.blog.canManage.useQuery();
  const postQuery = trpc.blog.get.useQuery(
    { id: postId ?? "" },
    { enabled: Boolean(postId) && canManage.data === true },
  );

  useEffect(() => {
    if (!postQuery.data) {
      return;
    }
    setDraft({
      slug: postQuery.data.slug,
      title: postQuery.data.title,
      description: postQuery.data.description,
      body: postQuery.data.body,
      titleJa: postQuery.data.titleJa,
      descriptionJa: postQuery.data.descriptionJa,
      bodyJa: postQuery.data.bodyJa,
      author: postQuery.data.author,
    });
    setSlugTouched(true);
  }, [postQuery.data]);

  const createPost = trpc.blog.create.useMutation({
    onSuccess: async (post) => {
      toast.success(t("Draft saved"));
      await utils.blog.list.invalidate();
      router.replace(`/settings/blog/${post.id}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const updatePost = trpc.blog.update.useMutation({
    onSuccess: async () => {
      toast.success(t("Draft saved"));
      await Promise.all([
        utils.blog.list.invalidate(),
        postId ? utils.blog.get.invalidate({ id: postId }) : null,
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const publishPost = trpc.blog.publish.useMutation({
    onSuccess: async () => {
      toast.success(t("Published"));
      await Promise.all([
        utils.blog.list.invalidate(),
        postId ? utils.blog.get.invalidate({ id: postId }) : null,
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const unpublishPost = trpc.blog.unpublish.useMutation({
    onSuccess: async () => {
      toast.success(t("Moved to draft"));
      await Promise.all([
        utils.blog.list.invalidate(),
        postId ? utils.blog.get.invalidate({ id: postId }) : null,
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const previewMarkdown = localeTab === "ja" ? draft.bodyJa || draft.body : draft.body;
  const isSaving = createPost.isPending || updatePost.isPending;
  const isPublishing = publishPost.isPending || unpublishPost.isPending;
  const status = postQuery.data?.status ?? "draft";

  const canSave = useMemo(() => draft.title.trim().length > 0, [draft.title]);

  const saveDraft = async () => {
    const payload = {
      ...draft,
      slug: slugifyBlogTitle(draft.slug || draft.title),
    };
    if (!payload.slug) {
      toast.error(t("Add a title or slug first."));
      return null;
    }
    if (isNew) {
      return createPost.mutateAsync(payload);
    }
    return updatePost.mutateAsync({ id: postId, ...payload });
  };

  if (canManage.isLoading || (postId && postQuery.isLoading)) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!canManage.data) {
    return (
      <SettingsPageShell title={t("Blog")} description={t("You cannot edit blog posts.")}>
        <Button variant="outline" asChild>
          <Link href="/settings/blog">{t("Back")}</Link>
        </Button>
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      title={isNew ? t("New post") : t("Edit post")}
      description={t(
        "English is required. Japanese is optional and used when a visitor reads the site in Japanese.",
      )}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings/blog">
              <ArrowLeft className="size-4" />
              {t("All posts")}
            </Link>
          </Button>
          <Button
            variant="outline"
            disabled={!canSave || isSaving}
            onClick={() => void saveDraft()}
          >
            <Save className="size-4" />
            {isSaving ? t("Saving…") : t("Save draft")}
          </Button>
          {postId && status === "published" ? (
            <Button
              variant="outline"
              disabled={isPublishing}
              onClick={() => unpublishPost.mutate({ id: postId })}
            >
              {t("Unpublish")}
            </Button>
          ) : null}
          {postId ? (
            <Button
              disabled={isPublishing || isSaving}
              onClick={() => {
                void saveDraft()
                  .then((saved) => {
                    if (saved) {
                      publishPost.mutate({ id: saved.id });
                    }
                  })
                  .catch(() => undefined);
              }}
            >
              {t("Publish")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="blog-title">{t("Title")}</Label>
          <Input
            id="blog-title"
            value={draft.title}
            placeholder={t("How to keep AI chats useful after the first week")}
            onChange={(event) => {
              const title = event.target.value;
              setDraft((current) => ({
                ...current,
                title,
                slug: slugTouched ? current.slug : slugifyBlogTitle(title),
              }));
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="blog-slug">{t("Slug")}</Label>
            <Input
              id="blog-slug"
              value={draft.slug}
              placeholder="keep-ai-chats-useful"
              onChange={(event) => {
                setSlugTouched(true);
                setDraft((current) => ({ ...current, slug: event.target.value }));
              }}
            />
            <p className="text-xs text-muted-foreground">/blog/{draft.slug || "your-slug"}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="blog-author">{t("Author")}</Label>
            <Input
              id="blog-author"
              value={draft.author}
              onChange={(event) =>
                setDraft((current) => ({ ...current, author: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="blog-description">{t("Excerpt")}</Label>
          <Textarea
            id="blog-description"
            value={draft.description}
            className="min-h-20"
            placeholder={t("One or two sentences shown on the blog index and in search results.")}
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
          />
        </div>

        <Tabs value={localeTab} onValueChange={setLocaleTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="en">{t("English")}</TabsTrigger>
              <TabsTrigger value="ja">{t("Japanese")}</TabsTrigger>
            </TabsList>
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList>
                <TabsTrigger value="write">{t("Write")}</TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="size-3.5" />
                  {t("Preview")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <TabsContent value="en" className="mt-4 space-y-3">
            {mode === "preview" ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <BlogMarkdown markdown={draft.body} />
              </div>
            ) : (
              <Textarea
                value={draft.body}
                className="min-h-80 font-mono text-sm"
                placeholder={t("Write in Markdown. Use ## headings, lists, and links.")}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, body: event.target.value }))
                }
              />
            )}
          </TabsContent>

          <TabsContent value="ja" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="blog-title-ja">{t("Japanese title")}</Label>
              <Input
                id="blog-title-ja"
                value={draft.titleJa}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, titleJa: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-description-ja">{t("Japanese excerpt")}</Label>
              <Textarea
                id="blog-description-ja"
                value={draft.descriptionJa}
                className="min-h-20"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, descriptionJa: event.target.value }))
                }
              />
            </div>
            {mode === "preview" ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <BlogMarkdown markdown={previewMarkdown} />
              </div>
            ) : (
              <Textarea
                value={draft.bodyJa}
                className="min-h-80 font-mono text-sm"
                placeholder={t("Optional Japanese Markdown. English is used if this is empty.")}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bodyJa: event.target.value }))
                }
              />
            )}
          </TabsContent>
        </Tabs>

        {status === "published" && postQuery.data ? (
          <p className="text-xs text-muted-foreground">
            {t("Live at")}{" "}
            <Link
              href={`/blog/${postQuery.data.slug}`}
              className="underline-offset-4 hover:underline"
            >
              /blog/{postQuery.data.slug}
            </Link>
          </p>
        ) : null}
      </div>
    </SettingsPageShell>
  );
}
