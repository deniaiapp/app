import { ChatInterfaceSkeleton } from "@/components/chat/chat-interface-skeleton";

/** Shown only if the thin route chunk is still loading; host paints over it. */
export default function ChatIdLoading() {
  return <ChatInterfaceSkeleton />;
}
