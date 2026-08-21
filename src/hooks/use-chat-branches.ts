import type { UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useState } from "react";

type PendingMetadata = {
  branchGroupId?: string;
  [key: string]: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RegenOptions = { body?: any; messageId?: string };

interface UseChatBranchesOptions {
  messages: UIMessage[];
  setMessages: (msgs: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  regenerate: (options?: RegenOptions) => void | Promise<void>;
}

export interface BranchGroup {
  type: "branch";
  groupId: string;
  messages: UIMessage[];
}

export interface SingleMessage {
  type: "single";
  message: UIMessage;
}

export type GroupedMessage = BranchGroup | SingleMessage;

type PendingBranch = {
  groupId: string;
  originalMessage: UIMessage;
  messagesBeforeRegen: UIMessage[];
};

function getBranchGroupId(message: UIMessage): string | undefined {
  return (message.metadata as PendingMetadata | undefined)?.branchGroupId;
}

function withBranchGroupId(message: UIMessage, groupId: string): UIMessage {
  return {
    ...message,
    metadata: { ...(message.metadata as PendingMetadata | undefined), branchGroupId: groupId },
  };
}

export function groupMessages(messages: UIMessage[]): GroupedMessage[] {
  const result: GroupedMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    const groupId = getBranchGroupId(msg);

    if (groupId && msg.role === "assistant") {
      // Collect all consecutive assistant messages with the same groupId
      const branchMsgs: UIMessage[] = [msg];
      let j = i + 1;
      while (
        j < messages.length &&
        messages[j].role === "assistant" &&
        getBranchGroupId(messages[j]) === groupId
      ) {
        branchMsgs.push(messages[j]);
        j++;
      }
      result.push({ type: "branch", groupId, messages: branchMsgs });
      i = j;
    } else {
      result.push({ type: "single", message: msg });
      i++;
    }
  }

  return result;
}

function mergePendingBranch(messages: UIMessage[], pending: PendingBranch | null): UIMessage[] {
  if (!pending) {
    return messages;
  }

  const lastMsg = messages.at(-1);
  if (!lastMsg || lastMsg.role !== "assistant" || lastMsg === pending.originalMessage) {
    return messages;
  }
  if (getBranchGroupId(lastMsg) === pending.groupId) {
    return messages;
  }

  return [
    ...pending.messagesBeforeRegen,
    withBranchGroupId(pending.originalMessage, pending.groupId),
    withBranchGroupId(lastMsg, pending.groupId),
  ];
}

export function useChatBranches({ messages, setMessages, regenerate }: UseChatBranchesOptions) {
  const [pendingBranch, setPendingBranch] = useState<PendingBranch | null>(null);

  function handleRegenerate(options?: RegenOptions) {
    const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");
    if (lastAssistantIdx === -1) {
      void regenerate(options);
      return;
    }

    const lastAssistant = messages[lastAssistantIdx];
    const existingGroupId = getBranchGroupId(lastAssistant);
    const groupId = existingGroupId ?? nanoid(8);
    const pending: PendingBranch = {
      groupId,
      originalMessage: lastAssistant,
      messagesBeforeRegen: messages.slice(0, lastAssistantIdx),
    };

    setPendingBranch(pending);

    void Promise.resolve()
      .then(() => regenerate(options))
      .finally(() => {
        setMessages((prev) => mergePendingBranch(prev, pending));
        setPendingBranch(null);
      });
  }

  const groupedMessages = groupMessages(mergePendingBranch(messages, pendingBranch));

  return { handleRegenerate, groupedMessages };
}
