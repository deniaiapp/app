"use client";

import { useChat } from "@ai-sdk/react";
import { sendGAEvent } from "@next/third-parties/google";
import type { FileUIPart, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import dynamic from "next/dynamic";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AdSenseSlot } from "@/components/adsense-slot";
import { ArtifactPreviewProvider } from "@/components/chat/artifact-preview-context";
import { ChatComposer, type ComposerMessage } from "@/components/chat/chat-composer";
import { ChatInterfaceHeader } from "@/components/chat/chat-interface-header";
import { ChatInterfaceMessages } from "@/components/chat/chat-interface-messages";
import { UsageAlerts } from "@/components/chat/usage-alerts";
import { env } from "@/env";
import { useAvailableModels } from "@/hooks/use-available-models";
import { useInitialMessage } from "@/hooks/use-initial-message";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useChatBranches } from "@/hooks/use-chat-branches";
import { useMemorySaveNotice } from "@/hooks/use-memory-save-notice";
import { useNewChat } from "@/hooks/use-new-chat";
import { useUsageStatus } from "@/hooks/use-usage-status";
import { authClient } from "@/lib/auth-client";
import { isBillingDisabled } from "@/lib/billing-config";
import {
  defaultModel,
  GA_ID,
  getPreferredReasoningEffort,
  type ReasoningEffort,
} from "@/lib/constants";
import { trpc } from "@/lib/trpc/react";

const ArtifactPreviewPanel = dynamic(
  () => import("@/components/chat/artifact-preview-panel").then((mod) => mod.ArtifactPreviewPanel),
  { ssr: false },
);

interface ChatInterfaceProps {
  id: string;
  initialMessages?: UIMessage[];
  initialTitle?: string | null;
  initialProjectId?: string | null;
  initialProjectName?: string | null;
}

type UploadableFileUIPart = FileUIPart & { file?: File };
type PendingMessageMetadata = {
  pending?: boolean;
  [key: string]: unknown;
};

async function uploadAttachment(file: UploadableFileUIPart): Promise<FileUIPart> {
  if (!file.url || !file.file) {
    return file;
  }

  if (
    file.url.startsWith("https://") ||
    file.url.startsWith("http://") ||
    file.url.startsWith("data:")
  ) {
    return file;
  }

  const formData = new FormData();
  formData.set("file", file.file);

  const uploadResponse = await fetch("/api/upload-attachment", {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("Attachment upload failed.");
  }

  const payload = (await uploadResponse.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Attachment upload failed.");
  }

  return { ...file, url: payload.url };
}

async function normalizeAttachments(files?: UploadableFileUIPart[]) {
  if (!files?.length) {
    return undefined;
  }

  const normalized = await Promise.all(
    files.map(async (file) => {
      if (!file.url) {
        return file;
      }

      if (file.url.startsWith("https://") || file.url.startsWith("http://")) {
        return file;
      }

      return uploadAttachment(file);
    }),
  );

  return normalized;
}

function getMessageRenderKeys(messages: UIMessage[]) {
  const occurrences = new Map<string, number>();

  return messages.map((message, index) => {
    const baseKey =
      typeof message.id === "string" && message.id.trim().length > 0
        ? message.id.trim()
        : `message-${index}`;
    const duplicateCount = occurrences.get(baseKey) ?? 0;

    occurrences.set(baseKey, duplicateCount + 1);

    return duplicateCount === 0 ? baseKey : `${baseKey}-${duplicateCount}`;
  });
}

function isPendingMessage(message: UIMessage | undefined) {
  if (!message || message.role !== "assistant") {
    return false;
  }

  return Boolean((message.metadata as PendingMessageMetadata | undefined)?.pending);
}

function handleFocusComposer() {
  window.dispatchEvent(new CustomEvent("deni:focus-composer"));
}

export function ChatInterface({
  id,
  initialMessages = [],
  initialTitle = null,
  initialProjectId = null,
  initialProjectName = null,
}: ChatInterfaceProps) {
  const t = useExtracted();
  const session = authClient.useSession();
  const isAnonymous = Boolean(session.data?.user?.isAnonymous);
  const billingDisabled = isBillingDisabled;
  const [input, setInput] = useState("");
  const [model, setModel] = useState(defaultModel.value);
  const [webSearch, setWebSearch] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() =>
    getPreferredReasoningEffort(defaultModel.efforts),
  );
  const [proMode, setProMode] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { availableModels, providerSettings, providerKeys } = useAvailableModels();
  const {
    usageQuery,
    selectedModel,
    usageTier,
    isByokActive,
    isUsageLow,
    isUsageBlocked,
    canEnableMaxMode,
    isSubmitBlocked,
    usageCategoryLabel,
    usageTierLabel,
    remainingUsage,
    usageUnitLabel,
    enableMaxMode,
  } = useUsageStatus({ model, availableModels, providerKeys, providerSettings, proMode });

  const requestBody = {
    model,
    webSearch,
    reasoningEffort,
    proMode,
    deepResearch,
    video: videoMode,
    image: imageMode,
    id,
  };
  const transport = new DefaultChatTransport({
    body: {
      id,
    },
  });

  const { messages, sendMessage, regenerate, setMessages, status, error, stop } = useChat({
    id,
    messages: initialMessages,
    transport,
  });

  const { handleRegenerate, groupedMessages } = useChatBranches({
    messages,
    setMessages,
    regenerate,
  });
  const previousStatusRef = useRef(status);
  const showMessageActions = status !== "streaming" && status !== "submitted";
  const lastMessage = messages.at(-1);
  const isWaitingForResponse =
    status !== "streaming" && status !== "submitted" && isPendingMessage(lastMessage);
  // Only poll the generation marker. Fetch the full transcript once the
  // server clears the pending generation, instead of transferring JSONB every
  // second while waiting for a response.
  const chatStatusQuery = trpc.chat.getChatStatus.useQuery(
    { id },
    {
      enabled: isWaitingForResponse,
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnReconnect: true,
      refetchIntervalInBackground: true,
      refetchInterval: isWaitingForResponse ? 1000 : false,
    },
  );

  useInitialMessage({
    id,
    initialMessagesLength: initialMessages.length,
    model,
    sendMessage,
    setModel,
    setWebSearch,
    setVideoMode,
    setImageMode,
    setReasoningEffort,
    setProMode,
    setDeepResearch,
    onMessageSent: () => utils.chat.getChats.invalidate(),
  });

  const lastRecoveredStatusRef = useRef<number | null>(null);

  useEffect(() => {
    const statusUpdatedAt = chatStatusQuery.data?.updated_at?.getTime() ?? null;

    if (
      !isWaitingForResponse ||
      !chatStatusQuery.isSuccess ||
      chatStatusQuery.data?.activeGenerationId ||
      statusUpdatedAt === null ||
      lastRecoveredStatusRef.current === statusUpdatedAt
    ) {
      return;
    }

    lastRecoveredStatusRef.current = statusUpdatedAt;
    let cancelled = false;

    void utils.chat.getChatPage
      .fetch({ id })
      .then((chat) => {
        if (cancelled || !chat?.messages) {
          return;
        }

        const serverMessages = chat.messages as UIMessage[];

        // The status query can race the final /api/chat persist. Never clobber
        // optimistic local state with an empty/shorter server snapshot.
        setMessages((current) => {
          if (serverMessages.length === 0 && current.length > 0) {
            return current;
          }
          if (serverMessages.length < current.length) {
            return current;
          }

          const localUserCount = current.filter((message) => message.role === "user").length;
          const serverUserCount = serverMessages.filter(
            (message) => message.role === "user",
          ).length;
          if (localUserCount > serverUserCount) {
            return current;
          }

          return serverMessages;
        });
      })
      .catch(() => {
        if (!cancelled) {
          lastRecoveredStatusRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    chatStatusQuery.data,
    chatStatusQuery.isSuccess,
    id,
    isWaitingForResponse,
    setMessages,
    utils,
  ]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    const hadInFlightRequest = previousStatus === "submitted" || previousStatus === "streaming";
    const requestSettled = status === "ready" || status === "error";

    if (!hadInFlightRequest || !requestSettled) {
      return;
    }

    void utils.billing.usage.invalidate();
    // Keep SPA ChatRouteHost cache in sync after a generation settles.
    void utils.chat.getChatPage.invalidate({ id });
  }, [id, status, utils]);

  useMemorySaveNotice({ status });

  const handleSubmit = async (
    message: ComposerMessage,
    options: {
      model: string;
      webSearch: boolean;
      videoMode: boolean;
      imageMode: boolean;
      reasoningEffort: ReasoningEffort;
      proMode: boolean;
      deepResearch: boolean;
    },
  ) => {
    if (isSubmitBlocked) {
      return;
    }
    setAttachmentError(null);

    let attachments: FileUIPart[] | undefined;
    try {
      attachments = await normalizeAttachments(message.files);
    } catch (error) {
      setAttachmentError(
        error instanceof Error ? error.message : t("Failed to upload attachment."),
      );
      return;
    }

    if (GA_ID) {
      sendGAEvent("event", "chat_message_sent", {
        event_category: "chat",
        event_label: usageTier,
        value: 1,
      });
    }

    if (message.text || attachments?.length) {
      Promise.resolve(
        sendMessage(
          {
            text: message.text || "",
            files: attachments,
          },
          {
            body: {
              model: options.model,
              webSearch: options.webSearch,
              reasoningEffort: options.reasoningEffort,
              proMode: options.proMode,
              deepResearch: options.deepResearch,
              video: options.videoMode,
              image: options.imageMode,
              id,
            },
          },
        ),
      ).finally(() => {
        utils.chat.getChats.invalidate();
      });
      setInput("");
    }
  };

  // Adjust invalid model during render (avoids setState-in-effect cascade).
  if (!selectedModel && availableModels.length > 0) {
    setModel(availableModels[0].value);
  }

  const handleModelChange = (value: string) => {
    setModel(value);
    const nextModel = availableModels.find((entry) => entry.value === value);
    const nextEfforts = nextModel?.efforts;
    if (!nextModel?.supportsProMode) {
      setProMode(false);
    }
    if (!nextEfforts) {
      return;
    }
    setReasoningEffort((current) =>
      nextEfforts.includes(current) ? current : getPreferredReasoningEffort(nextEfforts),
    );
  };

  const handleStop = () => {
    stop();

    void fetch("/api/chat/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });
  };

  const messageRenderKeys = getMessageRenderKeys(messages);
  const messageIndexMap = new Map<UIMessage, number>();
  for (let i = 0; i < messages.length; i++) {
    messageIndexMap.set(messages[i], i);
  }

  const startNewChat = useNewChat();

  useKeyboardShortcuts({
    onFocusComposer: handleFocusComposer,
    onNewChat: () => startNewChat(),
  });

  return (
    <ArtifactPreviewProvider>
      <ArtifactPreviewPanel />
      <div className="flex h-full flex-1 min-h-0 flex-col w-full max-w-3xl mx-auto p-4 overflow-hidden">
        <ChatInterfaceHeader
          messages={messages}
          initialTitle={initialTitle}
          initialProjectId={initialProjectId}
          initialProjectName={initialProjectName}
        />
        <ChatInterfaceMessages
          messages={messages}
          groupedMessages={groupedMessages}
          messageRenderKeys={messageRenderKeys}
          messageIndexMap={messageIndexMap}
          status={status}
          showMessageActions={showMessageActions}
          isSubmitBlocked={isSubmitBlocked}
          isWaitingForResponse={isWaitingForResponse}
          error={error}
          attachmentError={attachmentError}
          initialProjectId={initialProjectId}
          requestBody={requestBody}
          onRegenerate={handleRegenerate}
          availableModels={availableModels}
          onModelChange={handleModelChange}
          onWebSearchChange={setWebSearch}
        />

        <UsageAlerts
          status={{
            isAnonymous,
            isByokActive,
            isUsageLow,
            isUsageBlocked,
            canEnableMaxMode,
            billingDisabled,
          }}
          usage={{
            remaining: remainingUsage,
            unitLabel: usageUnitLabel,
            categoryLabel: usageCategoryLabel,
            tierLabel: usageTierLabel,
          }}
          enableMaxMode={enableMaxMode}
          onRefreshUsage={() => usageQuery.refetch()}
        />

        <ChatComposer
          className="mt-4"
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          status={status}
          isSubmitDisabled={isSubmitBlocked}
          model={model}
          onModelChange={handleModelChange}
          webSearch={webSearch}
          onWebSearchChange={setWebSearch}
          videoMode={videoMode}
          onVideoModeChange={setVideoMode}
          imageMode={imageMode}
          onImageModeChange={setImageMode}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={setReasoningEffort}
          proMode={proMode}
          onProModeChange={setProMode}
          deepResearch={deepResearch}
          onDeepResearchChange={setDeepResearch}
          showByokBadge={isByokActive}
        />
        <AdSenseSlot
          slot={env.NEXT_PUBLIC_ADSENSE_CHAT_SLOT_ID ?? ""}
          className="mx-auto mt-3 w-full max-w-xl border-border/40 bg-background/40 p-2 shadow-none"
        />
      </div>
    </ArtifactPreviewProvider>
  );
}
