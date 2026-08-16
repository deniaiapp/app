import { renderBlogMarkdown } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

export function BlogMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-5 text-sm leading-8 text-muted-foreground [&_h1]:mt-2 [&_h2]:mt-2 [&_h3]:mt-2",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: renderBlogMarkdown(markdown) }}
    />
  );
}
