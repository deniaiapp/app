"use client";

import type { FileUIPart, UIMessage } from "ai";
import { ChevronDownIcon, CopyIcon, Globe } from "lucide-react";
import Link from "next/link";
import { useExtracted } from "next-intl";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import {
  isBrowseToolInput,
  isBrowseToolOutput,
  isSearchResultArray,
  isVideoToolOutput,
  resolveVeoModelLabel,
} from "@/components/chat/chat-utils";
import { getSafeDisplayUrl, toSafeHref } from "@/lib/safe-href";
import { cn } from "@/lib/utils";

function isFilePart(part: UIMessage["parts"][number]): part is FileUIPart {
  return part.type === "file";
}

function isTextPart(
  part: UIMessage["parts"][number],
): part is Extract<UIMessage["parts"][number], { type: "text"; text: string }> {
  return part.type === "text";
}

function getPartRenderKeys(message: UIMessage): string[] {
  const occurrences = new Map<string, number>();

  return (message.parts ?? []).map((part) => {
    const toolCallId =
      "toolCallId" in part && typeof part.toolCallId === "string" ? part.toolCallId.trim() : "";
    const baseKey =
      toolCallId.length > 0
        ? `${message.id}-${part.type}-${toolCallId}`
        : `${message.id}-${part.type}`;
    const duplicateCount = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, duplicateCount + 1);
    return duplicateCount === 0 ? baseKey : `${baseKey}-${duplicateCount}`;
  });
}

function SharedAssistantParts({ message }: { message: UIMessage }) {
  const t = useExtracted();
  const parts = message.parts ?? [];
  const partRenderKeys = getPartRenderKeys(message);

  return (
    <div className="space-y-2">
      {parts.map((part, position) => {
        const renderKey = partRenderKeys[position];
        const isLastPart = position === parts.length - 1;
        switch (part.type) {
          case "text":
            return (
              <Message key={renderKey} from={message.role}>
                <MessageContent>
                  <MessageResponse>{part.text}</MessageResponse>
                </MessageContent>
                {isLastPart && (
                  <MessageActions>
                    <MessageAction
                      onClick={() => navigator.clipboard.writeText(part.text)}
                      label={t("Copy")}
                    >
                      <CopyIcon className="size-3.5" />
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            );
          case "reasoning":
            return (
              <Reasoning key={renderKey} className="w-full">
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          case "tool-search": {
            if (part.state !== "output-available" && part.state !== "output-error") {
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
                >
                  <Globe className="size-4" />
                  <Shimmer>{t("Searching...")}</Shimmer>
                </div>
              );
            }

            if (part.state === "output-error") {
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-2 text-muted-foreground text-sm"
                >
                  <Globe className="size-4" />
                  {t("Search failed")}
                </div>
              );
            }

            const searchResults = isSearchResultArray(part.output) ? part.output : [];

            return (
              <div className="w-full my-4" key={renderKey}>
                <Collapsible>
                  <CollapsibleTrigger className="group flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
                    <Globe className="size-4" />
                    {t("Searched {count} websites", {
                      count: searchResults.length.toString(),
                    })}
                    {searchResults.length !== 0 && (
                      <ChevronDownIcon
                        className={cn(
                          "size-4 ml-auto transition-transform",
                          "group-data-panel-open:rotate-180",
                        )}
                      />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent
                    className={cn(
                      "data-closed:fade-out-0 data-closed:slide-out-to-top-2 data-open:slide-in-from-top-2 text-muted-foreground outline-none data-closed:animate-out data-open:animate-in",
                    )}
                  >
                    <div className="space-y-4 mt-4">
                      {searchResults.map((result) => {
                        const displayUrl = getSafeDisplayUrl(result.url);
                        return (
                          <div
                            key={result.url}
                            className="p-0! bg-accent/40 hover:bg-accent rounded-md transition-colors"
                          >
                            <Link
                              href={displayUrl?.href ?? "#"}
                              className="block p-3"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {displayUrl ? (
                                <p className="text-sm text-primary mb-1 line-clamp-2">
                                  <span className="text-muted-foreground">{displayUrl.origin}</span>
                                  {displayUrl.hostname}
                                  <span className="text-muted-foreground">
                                    {`${displayUrl.pathname.slice(0, 50)}${displayUrl.pathname.length > 50 ? "..." : ""}`}
                                  </span>
                                </p>
                              ) : null}
                              <p className="font-medium text-sm text-primary mb-1 line-clamp-2">
                                {result.title}
                              </p>
                              <div className="text-xs text-muted-foreground line-clamp-3">
                                {result.description.slice(0, 100)}
                                {result.description.length > 100 && "..."}
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          }
          case "tool-browse": {
            if (part.state !== "output-available" && part.state !== "output-error") {
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
                >
                  <Globe className="size-4" />
                  <Shimmer>{t("Opening page...")}</Shimmer>
                </div>
              );
            }

            const browseOutput = isBrowseToolOutput(part.output) ? part.output : null;
            const browseInput = isBrowseToolInput(part.input) ? part.input : null;
            const browseUrl = browseOutput?.url ?? browseInput?.url ?? "";
            const displayUrl = getSafeDisplayUrl(browseUrl);
            const failed =
              part.state === "output-error" ||
              Boolean(browseOutput?.error && !browseOutput.content);

            if (failed) {
              return (
                <div
                  key={part.toolCallId}
                  className="flex items-center gap-2 text-muted-foreground text-sm"
                >
                  <Globe className="size-4" />
                  {t("Failed to open page")}
                </div>
              );
            }

            return (
              <div
                key={renderKey}
                className="flex items-center gap-2 text-muted-foreground text-sm"
              >
                <Globe className="size-4" />
                {displayUrl ? (
                  <Link
                    href={displayUrl.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    {t("Opened {host}", {
                      host: browseOutput?.title?.trim() || displayUrl.hostname,
                    })}
                  </Link>
                ) : (
                  t("Opened page")
                )}
              </div>
            );
          }
          case "tool-video": {
            if (part.state !== "output-available" && part.state !== "output-error") {
              return (
                <Message key={renderKey} from={message.role}>
                  <MessageContent className="w-full gap-2 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Spinner className="size-4" />
                      <span>{t("Generating video...")}</span>
                    </div>
                  </MessageContent>
                </Message>
              );
            }

            if (part.state === "output-error") {
              return (
                <Message key={renderKey} from={message.role}>
                  <MessageContent className="w-full text-sm text-destructive">
                    {t("Video generation failed.")}
                  </MessageContent>
                </Message>
              );
            }

            const output = isVideoToolOutput(part.output) ? part.output : null;

            if (!output) {
              return (
                <Message key={renderKey} from={message.role}>
                  <MessageContent className="w-full text-sm text-destructive">
                    {t("Video output unavailable.")}
                  </MessageContent>
                </Message>
              );
            }

            const resolvedModelLabel = resolveVeoModelLabel(output.model, output.modelLabel, t);

            return (
              <Message key={renderKey} from={message.role}>
                <MessageContent className="w-full gap-3 rounded-lg border border-border/60 bg-background/90 px-4 py-3">
                  {output.negativePrompt && (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                      <p className="text-xs font-medium text-foreground">{t("Negative prompt")}</p>
                      <p className="text-muted-foreground">{output.negativePrompt}</p>
                    </div>
                  )}
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/30">
                    {/* oxlint-disable-next-line: generated videos don't include captions. */}
                    <video controls src={output.videoUrl} className="h-auto w-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {output.resolution && <Badge variant="secondary">{output.resolution}</Badge>}
                    {output.aspectRatio && <Badge variant="secondary">{output.aspectRatio}</Badge>}
                    {output.durationSeconds && (
                      <Badge variant="secondary">{output.durationSeconds}s</Badge>
                    )}
                    {resolvedModelLabel ? (
                      <Badge variant="outline">{resolvedModelLabel}</Badge>
                    ) : null}
                    {output.seed !== null && output.seed !== undefined && (
                      <Badge variant="outline">
                        {t("Seed {seed}", {
                          seed: output.seed.toString(),
                        })}
                      </Badge>
                    )}
                  </div>
                  {output.operationName && (
                    <p className="break-words text-xs text-muted-foreground">
                      {t("Operation: {name}", {
                        name: output.operationName,
                      })}
                    </p>
                  )}
                  <div>
                    <Button asChild size="sm" variant="outline">
                      <a href={toSafeHref(output.videoUrl)} download>
                        {t("Download video")}
                      </a>
                    </Button>
                  </div>
                </MessageContent>
              </Message>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

export interface SharedChatMessagesProps {
  messages: UIMessage[];
  messageRenderKeys: string[];
}

export function SharedChatMessages({ messages, messageRenderKeys }: SharedChatMessagesProps) {
  const keyedMessages = messages.map((message, position) => ({
    message,
    renderKey: messageRenderKeys[position] ?? message.id,
  }));

  return (
    <Conversation className="flex-1 min-h-0 h-full">
      <ConversationContent>
        {keyedMessages.map(({ message, renderKey }) => {
          const fileParts = message.parts.filter(isFilePart);
          const textParts = message.parts.filter(isTextPart);

          return (
            <div key={renderKey}>
              {message.role === "user" && (
                <Message from="user">
                  <MessageContent>
                    {fileParts.length > 0 ? (
                      <Attachments variant="list" className="w-full">
                        {fileParts.map((part, partIndex) => (
                          <Attachment
                            data={{ ...part, id: `${message.id}-file-${partIndex}` }}
                            key={`${message.id}-file-${partIndex}`}
                            className="w-full bg-background/50"
                          >
                            <AttachmentPreview />
                            <AttachmentInfo showMediaType />
                          </Attachment>
                        ))}
                      </Attachments>
                    ) : null}
                    {textParts.map((part, partIndex) => (
                      <MessageResponse
                        key={`${message.id}-text-${partIndex}`}
                        shikiTheme={["github-light", "github-dark"]}
                      >
                        {part.text}
                      </MessageResponse>
                    ))}
                  </MessageContent>
                </Message>
              )}
              {message.role === "assistant" && <SharedAssistantParts message={message} />}
            </div>
          );
        })}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
