"use client";

import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { ChatInterfaceSkeleton } from "@/components/chat/chat-interface-skeleton";
import { makeTRPCClient } from "@/lib/trpc/client";
import { trpc } from "@/lib/trpc/react";

/**
 * SPA-style chat host (chat-js ChatRouteHost pattern).
 *
 * /chat and /chat/[id] pages render null so Next route transitions only swap a
 * thin segment. This host stays mounted in the app shell, keeps recently
 * visited chat panes alive, and loads message data via tRPC (prefetchable on
 * sidebar hover). Instant Navigations (cacheComponents + partialPrefetching)
 * make the route shell free; this host makes chat-to-chat feel like an SPA.
 */

const ChatHome = dynamic(() => import("@/components/chat/home"), {
  loading: () => <ChatInterfaceSkeleton />,
});

const ChatInterface = dynamic(
  () => import("@/components/chat/chat-interface").then((mod) => mod.ChatInterface),
  { loading: () => <ChatInterfaceSkeleton /> },
);

const MAX_MOUNTED_CHATS = 5;

function parseChatRoute(pathname: string): { kind: "home" } | { kind: "chat"; id: string } | null {
  if (pathname === "/chat") {
    return { kind: "home" };
  }
  const match = /^\/chat\/([^/]+)$/.exec(pathname);
  if (!match) {
    return null;
  }
  return { kind: "chat", id: match[1] };
}

function nextMountedIds(prev: string[], activeId: string): string[] {
  if (prev.includes(activeId) && prev[prev.length - 1] === activeId) {
    return prev;
  }
  const without = prev.filter((entry) => entry !== activeId);
  const next = [...without, activeId];
  if (next.length <= MAX_MOUNTED_CHATS) {
    return next;
  }
  const droppable = next.slice(0, -1);
  const keep = droppable.slice(-(MAX_MOUNTED_CHATS - 1));
  return [...keep, activeId];
}

function useChatPanePage(id: string, isActive: boolean, projectIdFromQuery: string | null) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const pageQuery = trpc.chat.getChatPage.useQuery(
    { id },
    {
      staleTime: 30_000,
      refetchOnWindowFocus: isActive,
      refetchOnReconnect: isActive,
    },
  );

  const shouldEnsure = isActive && pageQuery.isSuccess && pageQuery.data === null;

  const ensureQuery = useQuery({
    queryKey: ["chat", "ensureChat", id, projectIdFromQuery],
    queryFn: async () => {
      try {
        const row = await makeTRPCClient().chat.ensureChat.mutate({
          id,
          projectId: projectIdFromQuery,
        });
        utils.chat.getChatPage.setData({ id }, row);
        void utils.chat.getChats.invalidate();
        if (projectIdFromQuery) {
          router.replace(`/chat/${id}`);
        }
        return row;
      } catch {
        if (!utils.chat.getChatPage.getData({ id })) {
          router.replace("/chat");
        }
        throw new Error("Failed to ensure chat");
      }
    },
    enabled: shouldEnsure,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return pageQuery.data ?? ensureQuery.data ?? null;
}

function ChatPane({ id, isActive }: { id: string; isActive: boolean }) {
  const searchParams = useSearchParams();
  const projectIdFromQuery = searchParams.get("projectId");
  const page = useChatPanePage(id, isActive, projectIdFromQuery);

  if (!page) {
    return <ChatInterfaceSkeleton />;
  }

  return (
    <div className="-m-4 flex min-h-0 flex-1 overflow-hidden">
      <ChatInterface
        id={id}
        initialMessages={page.messages as UIMessage[]}
        initialTitle={page.title}
        initialProjectId={page.projectId}
        initialProjectName={page.projectName ?? null}
      />
    </div>
  );
}

function ChatPanes({ activeId }: { activeId: string }) {
  const [mountedIds, setMountedIds] = useState<string[]>([activeId]);
  const nextIds = nextMountedIds(mountedIds, activeId);
  if (nextIds !== mountedIds) {
    setMountedIds(nextIds);
  }

  return (
    <>
      {nextIds.map((id) => {
        const isActive = id === activeId;
        return (
          <div
            key={id}
            className={isActive ? "flex min-h-0 flex-1 flex-col" : "hidden"}
            aria-hidden={!isActive}
          >
            <Suspense fallback={<ChatInterfaceSkeleton />}>
              <ChatPane id={id} isActive={isActive} />
            </Suspense>
          </div>
        );
      })}
    </>
  );
}

function ChatRouteHostInner() {
  const pathname = usePathname();
  const route = parseChatRoute(pathname);

  if (!route) {
    return null;
  }

  if (route.kind === "home") {
    return (
      <div className="-m-4 flex min-h-0 flex-1 overflow-hidden">
        <ChatHome />
      </div>
    );
  }

  return <ChatPanes activeId={route.id} />;
}

export function ChatRouteHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = parseChatRoute(pathname) !== null;

  if (!isChatRoute) {
    return children;
  }

  return (
    <>
      {/* Keep layout RequireAuth mounted so unauthenticated / expired sessions
          still redirect. The page itself is null; this slot is the auth gate. */}
      <div hidden>{children}</div>
      <Suspense fallback={<ChatInterfaceSkeleton />}>
        <ChatRouteHostInner />
      </Suspense>
    </>
  );
}
