import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getChatGenerationContextById,
  removePendingAssistantMessage,
  stopChatGenerationState,
} from "@/lib/chat";
import { stopChatGeneration } from "@/lib/chat-generation";

export async function POST(req: Request) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  const userId = session?.session?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsedBody = z
    .object({
      id: z.string().min(1),
    })
    .safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const chat = await getChatGenerationContextById(parsedBody.data.id, userId);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  await stopChatGenerationState(chat.id, userId);
  stopChatGeneration(chat.id);
  await removePendingAssistantMessage(chat.id, userId);

  return NextResponse.json({ ok: true });
}
