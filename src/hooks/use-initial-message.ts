import type { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { models, resolveReasoningEffort, type ReasoningEffort } from "@/lib/constants";

const INITIAL_MESSAGE_STORAGE_KEY = "deni_initial_message:v1";

type SendMessage = ReturnType<typeof useChat>["sendMessage"];

type StoredInitialMessage = {
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

export type InitialComposerSeed = {
  webSearch: boolean;
  model?: string;
  videoMode: boolean;
  imageMode: boolean;
  reasoningEffort: ReasoningEffort;
  proMode: boolean;
  fastMode: boolean;
  deepResearch: boolean;
  projectId?: string | null;
};

type StoreListener = () => void;

const listeners = new Set<StoreListener>();
const consumedSeeds = new Map<string, InitialComposerSeed>();
let cachedStoredRaw: string | null = null;
let cachedStoredValue: StoredInitialMessage | null = null;

function emitInitialMessageStore() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeInitialMessageStore(onStoreChange: StoreListener) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function parseStoredInitialMessage(raw: string): StoredInitialMessage | null {
  try {
    const parsed = JSON.parse(raw) as StoredInitialMessage;
    if (!parsed || typeof parsed.text !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getServerStoredSnapshot(): StoredInitialMessage | null {
  return null;
}

function readStoredInitialMessage(): StoredInitialMessage | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(INITIAL_MESSAGE_STORAGE_KEY);
  if (raw === cachedStoredRaw) {
    return cachedStoredValue;
  }
  cachedStoredRaw = raw;
  cachedStoredValue = raw ? parseStoredInitialMessage(raw) : null;
  return cachedStoredValue;
}

function seedFromStored(stored: StoredInitialMessage, fallbackModel: string): InitialComposerSeed {
  const effectiveModel = stored.model ?? fallbackModel;
  const selectedModel = models.find((entry) => entry.value === effectiveModel);
  return {
    webSearch: Boolean(stored.webSearch),
    model: stored.model,
    videoMode: Boolean(stored.videoMode),
    imageMode: Boolean(stored.imageMode),
    reasoningEffort:
      resolveReasoningEffort(selectedModel?.efforts ?? false, stored.reasoningEffort) ?? "high",
    proMode: Boolean(stored.proMode && selectedModel?.supportsProMode),
    fastMode: Boolean(stored.fastMode && selectedModel?.supportsFastMode),
    deepResearch: Boolean(stored.deepResearch),
    projectId: stored.projectId ?? null,
  };
}

function decodeQueryMessage(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function useInitialMessage(params: {
  id: string;
  initialMessagesLength: number;
  model: string;
  sendMessage: SendMessage;
  onMessageSent: () => void;
}): InitialComposerSeed | null {
  const { id, initialMessagesLength, model, sendMessage, onMessageSent } = params;
  const searchParams = useSearchParams();
  const stored = useSyncExternalStore(
    subscribeInitialMessageStore,
    readStoredInitialMessage,
    getServerStoredSnapshot,
  );

  const initialMessageSentRef = useRef(false);
  const sendMessageRef = useRef(sendMessage);
  const onMessageSentRef = useRef(onMessageSent);
  const modelRef = useRef(model);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    onMessageSentRef.current = onMessageSent;
    modelRef.current = model;
  });

  const queryMessage = searchParams.get("message");
  const queryWebSearch = searchParams.get("webSearch") === "true";
  const liveSeed = stored
    ? seedFromStored(stored, model)
    : queryMessage
      ? {
          webSearch: queryWebSearch,
          videoMode: false,
          imageMode: false,
          reasoningEffort: "high" as const,
          proMode: false,
          fastMode: false,
          deepResearch: false,
        }
      : (consumedSeeds.get(id) ?? null);

  useEffect(() => {
    if (initialMessageSentRef.current || initialMessagesLength > 0) {
      return;
    }

    const storedData = readStoredInitialMessage();
    if (storedData) {
      initialMessageSentRef.current = true;
      consumedSeeds.set(id, seedFromStored(storedData, modelRef.current));
      sessionStorage.removeItem(INITIAL_MESSAGE_STORAGE_KEY);
      emitInitialMessageStore();

      const files = Array.isArray(storedData.files)
        ? storedData.files.filter(
            (file): file is { type: "file"; filename?: string; mediaType: string; url: string } =>
              Boolean(file?.url && file?.mediaType),
          )
        : [];

      const sendModel = storedData.model ?? modelRef.current;
      const sendSelected = models.find((entry) => entry.value === sendModel);
      const parsedReasoningEffort =
        resolveReasoningEffort(sendSelected?.efforts ?? false, storedData.reasoningEffort) ??
        "high";
      const parsedProMode = Boolean(storedData.proMode && sendSelected?.supportsProMode);
      const parsedFastMode = Boolean(storedData.fastMode && sendSelected?.supportsFastMode);

      Promise.resolve(
        sendMessageRef.current(
          {
            text: storedData.text,
            files: files.length > 0 ? files : undefined,
          },
          {
            body: {
              model: sendModel,
              webSearch: storedData.webSearch,
              reasoningEffort: parsedReasoningEffort,
              proMode: parsedProMode,
              fastMode: parsedFastMode,
              video: storedData.videoMode ?? false,
              image: storedData.imageMode ?? false,
              deepResearch: storedData.deepResearch ?? false,
              id,
            },
          },
        ),
      ).finally(() => {
        onMessageSentRef.current();
      });
      return;
    }

    const initialMessage = searchParams.get("message");
    if (!initialMessage) {
      return;
    }

    initialMessageSentRef.current = true;
    const decodedMessage = decodeQueryMessage(initialMessage);
    const initialWebSearch = searchParams.get("webSearch") === "true";
    consumedSeeds.set(id, {
      webSearch: initialWebSearch,
      videoMode: false,
      imageMode: false,
      reasoningEffort: "high",
      proMode: false,
      fastMode: false,
      deepResearch: false,
    });

    window.history.replaceState({}, "", `/chat/${id}`);
    emitInitialMessageStore();

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
  }, [searchParams, initialMessagesLength, id]);

  return liveSeed;
}
