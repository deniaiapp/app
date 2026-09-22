import type { UIMessage } from "ai";
import { safeValidateUIMessages } from "ai";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";

const SharedChatInterface = dynamic(
  () => import("@/components/chat/shared-chat-interface").then((mod) => mod.SharedChatInterface),
  {
    loading: () => (
      <div className="flex min-h-[60vh] w-full items-center justify-center text-sm text-muted-foreground">
        Loading shared chat…
      </div>
    ),
  },
);
import { db } from "@/db/drizzle";
import { chatShareRecipients, chatShares, chats, user } from "@/db/schema";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Shared Chat | Deni AI",
  description: "View a shared Deni AI conversation.",
};

function SharedChatFallback() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner className="size-5" />
    </div>
  );
}

async function SharedChatContent({ params }: { params: Promise<{ shareId: string }> }) {
  await connection();
  const { shareId } = await params;
  const headersPromise = headers();
  const sharePromise = db.select().from(chatShares).where(eq(chatShares.id, shareId));
  const sessionPromise = headersPromise.then((headersList) =>
    auth.api.getSession({ headers: headersList }),
  );

  const [session, shareRows] = await Promise.all([sessionPromise, sharePromise]);
  const userId = session?.session?.userId;
  const [share] = shareRows;

  if (!share) {
    notFound();
  }

  // Private shares require authentication
  if (share.visibility === "private") {
    if (!userId) {
      redirect("/auth/sign-in");
    }

    if (userId !== share.ownerId) {
      const [recipient] = await db
        .select()
        .from(chatShareRecipients)
        .where(
          and(
            eq(chatShareRecipients.shareId, share.id),
            eq(chatShareRecipients.recipientId, userId),
          ),
        );

      if (!recipient) {
        notFound();
      }
    }
  }

  const [chatRows, ownerRows] = await Promise.all([
    db
      .select({ id: chats.id, title: chats.title, messages: chats.messages })
      .from(chats)
      .where(eq(chats.id, share.chatId)),
    db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(eq(user.id, share.ownerId)),
  ]);

  const [chat] = chatRows;
  const [owner] = ownerRows;

  if (!chat) {
    notFound();
  }

  const validatedMessages = await safeValidateUIMessages<UIMessage>({
    messages: (chat.messages as UIMessage[]) ?? [],
  });

  const messages = validatedMessages.success ? validatedMessages.data : [];

  return (
    <SharedChatInterface
      shareId={shareId}
      chat={{ id: chat.id, title: chat.title }}
      messages={messages}
      owner={owner}
      allowFork={share.allowFork}
      isOwner={userId === share.ownerId}
      isLoggedIn={!!userId}
    />
  );
}

export default function SharedChatPage({ params }: { params: Promise<{ shareId: string }> }) {
  return (
    <Suspense fallback={<SharedChatFallback />}>
      <SharedChatContent params={params} />
    </Suspense>
  );
}
