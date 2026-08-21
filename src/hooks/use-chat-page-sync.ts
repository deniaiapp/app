import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/react";

export function useChatPageSync(params: {
  id: string;
  status: string;
  isWaitingForResponse: boolean;
  activeGenerationId: string | null | undefined;
  statusUpdatedAt: Date | null | undefined;
  isStatusSuccess: boolean;
  setMessages: (messages: UIMessage[] | ((current: UIMessage[]) => UIMessage[])) => void;
}) {
  const {
    id,
    status,
    isWaitingForResponse,
    activeGenerationId,
    statusUpdatedAt,
    isStatusSuccess,
    setMessages,
  } = params;
  const utils = trpc.useUtils();
  const lastRecoveredStatusRef = useRef<number | null>(null);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const recoveredAt = statusUpdatedAt?.getTime() ?? null;

    if (
      !isWaitingForResponse ||
      !isStatusSuccess ||
      activeGenerationId ||
      recoveredAt === null ||
      lastRecoveredStatusRef.current === recoveredAt
    ) {
      return;
    }

    lastRecoveredStatusRef.current = recoveredAt;
    let cancelled = false;

    void utils.chat.getChatPage
      .fetch({ id })
      .then((chat) => {
        if (cancelled || !chat?.messages) {
          return;
        }

        const serverMessages = chat.messages as UIMessage[];

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
    activeGenerationId,
    id,
    isStatusSuccess,
    isWaitingForResponse,
    setMessages,
    statusUpdatedAt,
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
    void utils.chat.getChatPage.invalidate({ id });
  }, [id, status, utils]);
}
