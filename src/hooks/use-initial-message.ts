import type { useChat } from "@ai-sdk/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { models, resolveReasoningEffort, type ReasoningEffort } from "@/lib/constants";

const INITIAL_MESSAGE_STORAGE_KEY = "deni_initial_message:v1";

type SendMessage = ReturnType<typeof useChat>["sendMessage"];

export function useInitialMessage(params: {
  id: string;
  initialMessagesLength: number;
  model: string;
  sendMessage: SendMessage;
  setModel: (model: string) => void;
  setWebSearch: (webSearch: boolean) => void;
  setVideoMode: (videoMode: boolean) => void;
  setImageMode: (imageMode: boolean) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setProMode: (enabled: boolean) => void;
  setFastMode: (enabled: boolean) => void;
  setDeepResearch: (enabled: boolean) => void;
  setProjectId?: (projectId: string | null) => void;
  onMessageSent: () => void;
}) {
  const {
    id,
    initialMessagesLength,
    model,
    sendMessage,
    setModel,
    setWebSearch,
    setVideoMode,
    setImageMode,
    setReasoningEffort,
    setProMode,
    setFastMode,
    setDeepResearch,
    setProjectId,
    onMessageSent,
  } = params;

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMessageSentRef = useRef(false);
  // Keep latest callbacks/setters without re-firing the mount send effect.
  const sendMessageRef = useRef(sendMessage);
  const onMessageSentRef = useRef(onMessageSent);
  const modelRef = useRef(model);
  sendMessageRef.current = sendMessage;
  onMessageSentRef.current = onMessageSent;
  modelRef.current = model;

  useEffect(() => {
    if (initialMessageSentRef.current || initialMessagesLength > 0) {
      return;
    }

    // Try to get initial message from sessionStorage first (new method with file support)
    const storedData = sessionStorage.getItem(INITIAL_MESSAGE_STORAGE_KEY);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData) as {
          text: string;
          files?: Array<{
            type?: "file";
            filename?: string;
            mediaType?: string;
            url?: string;
          }>;
          webSearch: boolean;
          model?: string;
          videoMode?: boolean;
          imageMode?: boolean;
          reasoningEffort?: string;
          proMode?: boolean;
          fastMode?: boolean;
          deepResearch?: boolean;
          projectId?: string | null;
        };
        const files = Array.isArray(parsed.files)
          ? parsed.files.filter(
              (file): file is { type: "file"; filename?: string; mediaType: string; url: string } =>
                Boolean(file?.url && file?.mediaType),
            )
          : [];

        initialMessageSentRef.current = true;

        // Clear the stored data to prevent re-sending on refresh
        sessionStorage.removeItem(INITIAL_MESSAGE_STORAGE_KEY);

        // Set state from stored data
        if (parsed.webSearch) {
          setWebSearch(true);
        }
        if (parsed.model) {
          setModel(parsed.model);
        }
        if (parsed.videoMode) {
          setVideoMode(true);
        }
        if (parsed.imageMode) {
          setImageMode(true);
        }
        const effectiveModel = parsed.model ?? modelRef.current;
        const selectedModel = models.find((entry) => entry.value === effectiveModel);
        const parsedReasoningEffort =
          resolveReasoningEffort(selectedModel?.efforts ?? false, parsed.reasoningEffort) ?? "high";
        const parsedProMode = Boolean(parsed.proMode && selectedModel?.supportsProMode);
        const parsedFastMode = Boolean(parsed.fastMode && selectedModel?.supportsFastMode);
        setReasoningEffort(parsedReasoningEffort);
        setProMode(parsedProMode);
        setFastMode(parsedFastMode);
        setDeepResearch(Boolean(parsed.deepResearch));
        setProjectId?.(parsed.projectId ?? null);

        // Send the message with files
        Promise.resolve(
          sendMessageRef.current(
            {
              text: parsed.text,
              files: files.length > 0 ? files : undefined,
            },
            {
              body: {
                model: effectiveModel,
                webSearch: parsed.webSearch,
                reasoningEffort: parsedReasoningEffort,
                proMode: parsedProMode,
                fastMode: parsedFastMode,
                video: parsed.videoMode ?? false,
                image: parsed.imageMode ?? false,
                deepResearch: parsed.deepResearch ?? false,
                id,
              },
            },
          ),
        ).finally(() => {
          onMessageSentRef.current();
        });

        return;
      } catch (e) {
        console.error("Failed to parse initial message from sessionStorage:", e);
        sessionStorage.removeItem(INITIAL_MESSAGE_STORAGE_KEY);
      }
    }

    // Fallback: check query parameters (legacy method, no file support)
    const initialMessage = searchParams.get("message");
    const initialWebSearch = searchParams.get("webSearch") === "true";

    if (initialMessage) {
      initialMessageSentRef.current = true;
      const decodedMessage = decodeURIComponent(initialMessage);

      // Set webSearch state if it was passed from home
      if (initialWebSearch) {
        setWebSearch(true);
      }

      // Remove the query params from URL to prevent re-sending on refresh
      router.replace(`/chat/${id}`, { scroll: false });

      // Send the message with the webSearch setting from query params
      Promise.resolve(
        sendMessageRef.current(
          { text: decodedMessage },
          {
            body: {
              model: modelRef.current,
              webSearch: initialWebSearch,
              reasoningEffort: "high",
              video: false,
              id,
            },
          },
        ),
      ).finally(() => {
        onMessageSentRef.current();
      });
    }
    // Intentionally only re-run when chat identity / empty-message gate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable; send via refs
  }, [searchParams, initialMessagesLength, router, id]);
}
