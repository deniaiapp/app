"use client";

import type { ChatStatus, FileUIPart, UIMessage } from "ai";
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
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { AssistantMessage } from "@/components/chat/assistant-message";
import type { ModelOption } from "@/components/chat/chat-composer";
import type { GroupedMessage } from "@/hooks/use-chat-branches";
import type { ReasoningEffort } from "@/lib/constants";
import { toDisplayChatRequestError } from "@/lib/chat-request-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RequestBody {
  model: string;
  webSearch: boolean;
  reasoningEffort: ReasoningEffort;
  proMode?: boolean;
  fastMode?: boolean;
  video: boolean;
  image: boolean;
  id: string;
  deepResearch?: boolean;
  responseStyle?: "retry" | "detailed" | "concise";
  forceWebSearch?: boolean;
  additionalInstruction?: string;
}

function isFilePart(part: UIMessage["parts"][number]): part is FileUIPart {
  return part.type === "file";
}

function isTextPart(
  part: UIMessage["parts"][number],
): part is Extract<UIMessage["parts"][number], { type: "text"; text: string }> {
  return part.type === "text";
}

export interface ChatInterfaceMessagesProps {
  messages: UIMessage[];
  groupedMessages: GroupedMessage[];
  messageRenderKeys: string[];
  messageIndexMap: Map<UIMessage, number>;
  status: ChatStatus;
  showMessageActions: boolean;
  isSubmitBlocked: boolean;
  isWaitingForResponse: boolean;
  error: Error | undefined;
  attachmentError: string | null;
  initialProjectId?: string | null;
  requestBody: RequestBody;
  onRegenerate: (options?: { body?: RequestBody; messageId?: string }) => void;
  availableModels: ModelOption[];
  onModelChange: (value: string) => void;
  onWebSearchChange: (value: boolean) => void;
}

export function ChatInterfaceMessages({
  messages,
  groupedMessages,
  messageRenderKeys,
  messageIndexMap,
  status,
  showMessageActions,
  isSubmitBlocked,
  isWaitingForResponse,
  error,
  attachmentError,
  initialProjectId,
  requestBody,
  onRegenerate,
  availableModels,
  onModelChange,
  onWebSearchChange,
}: ChatInterfaceMessagesProps) {
  const t = useExtracted();

  return (
    <Conversation className="flex-1 min-h-0 h-full">
      <ConversationContent>
        {groupedMessages.map((group, groupIndex) => {
          if (group.type === "single") {
            const message = group.message;
            const msgIndex = messageIndexMap.get(message) ?? -1;
            const renderKey = messageRenderKeys[msgIndex] ?? `group-${groupIndex}`;
            const fileParts = message.parts.filter(isFilePart);
            const textParts = message.parts.filter(isTextPart);
            return (
              <div className="chat-message-group" key={renderKey}>
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
                {message.role === "assistant" && (
                  <AssistantMessage
                    message={message}
                    state={{
                      isLastMessage: msgIndex === messages.length - 1,
                      isStreaming: status === "streaming",
                      showActions: showMessageActions,
                      isSubmitBlocked,
                    }}
                    projectId={initialProjectId}
                    requestBody={requestBody}
                    onRegenerate={onRegenerate}
                    availableModels={availableModels}
                    onModelChange={onModelChange}
                    onWebSearchChange={onWebSearchChange}
                  />
                )}
              </div>
            );
          }

          const lastBranchIndex =
            messageIndexMap.get(group.messages[group.messages.length - 1]) ?? -1;
          return (
            <MessageBranch
              className="chat-message-group"
              key={`branch-${group.groupId}`}
              defaultBranch={group.messages.length - 1}
            >
              <MessageBranchSelector>
                <MessageBranchPrevious />
                <MessageBranchPage />
                <MessageBranchNext />
              </MessageBranchSelector>
              <MessageBranchContent>
                {group.messages.map((message, branchIdx) => (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    state={{
                      isLastMessage:
                        branchIdx === group.messages.length - 1 &&
                        lastBranchIndex === messages.length - 1,
                      isStreaming: status === "streaming",
                      showActions: showMessageActions,
                      isSubmitBlocked,
                    }}
                    projectId={initialProjectId}
                    requestBody={requestBody}
                    onRegenerate={onRegenerate}
                    availableModels={availableModels}
                    onModelChange={onModelChange}
                    onWebSearchChange={onWebSearchChange}
                  />
                ))}
              </MessageBranchContent>
            </MessageBranch>
          );
        })}
        {status === "submitted" && (
          <div className="min-h-6">
            <Loader />
          </div>
        )}

        {isWaitingForResponse && (
          <Card className="!gap-0 bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader />
                <span>{t("Waiting for response...")}</span>
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        {error && (
          <Card className="!gap-0 bg-destructive/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{t("Error")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm break-words">
                {toDisplayChatRequestError(error, t("An unexpected error occurred."))}
              </div>
            </CardContent>
          </Card>
        )}

        {attachmentError && (
          <Card className="!gap-0 bg-destructive/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{t("Error")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm break-words">{attachmentError}</div>
            </CardContent>
          </Card>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
