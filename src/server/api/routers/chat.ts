import type { UIMessage } from "ai";
import { safeValidateUIMessages } from "ai";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { getAccessibleProject } from "@/lib/project-access";
import { z } from "zod";
import type { db as Db } from "@/db/drizzle";
import { chats, projects } from "@/db/schema";
import { protectedProcedure, router } from "../trpc";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChatPagePayload = {
  id: string;
  title: string | null;
  projectId: string | null;
  projectName: string | null;
  projectDefaultModel: string | null;
  messages: UIMessage[];
};

async function loadChatPage(
  database: typeof Db,
  userId: string,
  id: string,
): Promise<ChatPagePayload | null> {
  const [row] = await database
    .select({
      id: chats.id,
      title: chats.title,
      projectId: chats.projectId,
      messages: chats.messages,
      projectName: projects.name,
      projectDefaultModel: projects.defaultModel,
    })
    .from(chats)
    .leftJoin(projects, eq(projects.id, chats.projectId))
    .where(and(eq(chats.id, id), eq(chats.uid, userId)))
    .limit(1);

  if (!row) {
    return null;
  }

  let projectName = row.projectName ?? null;
  let projectDefaultModel = row.projectDefaultModel ?? null;
  if (row.projectId) {
    const accessible = await getAccessibleProject(database, userId, row.projectId);
    if (!accessible) {
      projectName = null;
      projectDefaultModel = null;
    }
  }

  const validated = await safeValidateUIMessages<UIMessage>({
    messages: (row.messages as UIMessage[]) ?? [],
  });

  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId,
    projectName,
    projectDefaultModel,
    messages: validated.success ? validated.data : [],
  };
}

export const chatRouter = router({
  getChats: protectedProcedure.query(async ({ ctx }) => {
    const userChats = await ctx.db
      .select({
        id: chats.id,
        title: chats.title,
        projectId: chats.projectId,
        pinned: chats.pinned,
        folder: chats.folder,
        tags: chats.tags,
        created_at: chats.created_at,
        updated_at: chats.updated_at,
      })
      .from(chats)
      .where(eq(chats.uid, ctx.userId))
      .orderBy(desc(chats.updated_at))
      .limit(100);
    return userChats;
  }),
  createChat: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().min(1).nullable(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const newChat = await ctx.db
        .insert(chats)
        .values({
          uid: ctx.userId,
          projectId: input?.projectId ?? null,
          title: "New Chat",
        })
        .returning();
      return newChat[0].id;
    }),
  /**
   * Chat pane payload for SPA ChatRouteHost (messages + project label).
   * null when the id is missing or owned by another user.
   */
  getChatPage: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return loadChatPage(ctx.db, ctx.userId, input.id);
    }),
  /**
   * Lightweight generation status for recovering a pending assistant message.
   * Do not poll the full chat row: messages are stored in JSONB and can be
   * substantially larger than the status needed by the client.
   */
  getChatStatus: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [status] = await ctx.db
        .select({
          activeGenerationId: chats.activeGenerationId,
          updated_at: chats.updated_at,
        })
        .from(chats)
        .where(and(eq(chats.id, input.id), eq(chats.uid, ctx.userId)))
        .limit(1);

      return status ?? null;
    }),
  /**
   * Upsert used when the client navigates to /chat/<uuid> before the row exists
   * (new chat flow). Returns the page payload so the host can paint immediately.
   */
  ensureChat: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        projectId: z.string().min(1).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!UUID_RE.test(input.id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid chat id" });
      }

      const existing = await loadChatPage(ctx.db, ctx.userId, input.id);
      if (existing) {
        return existing;
      }

      let projectId: string | null = null;
      const rawProjectId = input.projectId ?? null;
      if (rawProjectId && UUID_RE.test(rawProjectId)) {
        const accessible = await getAccessibleProject(ctx.db, ctx.userId, rawProjectId);
        if (accessible && !accessible.archivedAt) {
          projectId = accessible.id;
        }
      }

      await ctx.db
        .insert(chats)
        .values({
          id: input.id,
          uid: ctx.userId,
          projectId,
          title: "New Chat",
        })
        .onConflictDoNothing();

      const row = await loadChatPage(ctx.db, ctx.userId, input.id);
      if (!row) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Chat not found",
        });
      }
      return row;
    }),
  getChat: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const chat = await ctx.db
        .select()
        .from(chats)
        .where(and(eq(chats.id, input.id), eq(chats.uid, ctx.userId)));
      return chat;
    }),
  updateChat: protectedProcedure
    .input(
      z
        .object({
          id: z.string().min(1),
          title: z.string().nullable(),
          messages: z.array(
            z.object({
              id: z.uuid(),
              role: z.enum(["user", "assistant"]),
              parts: z.json(),
              attachments: z.json(),
              createdAt: z.date(),
            }),
          ),
          pinned: z.boolean(),
          folder: z.string().trim().max(80).nullable(),
          projectId: z.string().trim().min(1).nullable(),
          tags: z.array(z.string().trim().min(1).max(32)).max(12),
        })
        .partial(),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Chat ID is required",
        });
      }
      const { id, ...fields } = input;
      const updatedChat = await ctx.db
        .update(chats)
        .set({ ...fields, updated_at: new Date() })
        .where(and(eq(chats.id, id), eq(chats.uid, ctx.userId)))
        .returning();
      if (!updatedChat[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }
      return updatedChat[0].id;
    }),
  deleteChat: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deletedChat = await ctx.db
        .delete(chats)
        .where(and(eq(chats.id, input.id), eq(chats.uid, ctx.userId)))
        .returning();
      if (!deletedChat[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }
      return deletedChat[0];
    }),
  deleteAllChats: protectedProcedure.mutation(async ({ ctx }) => {
    const deletedChats = await ctx.db
      .delete(chats)
      .where(eq(chats.uid, ctx.userId))
      .returning({ id: chats.id });

    return { deletedCount: deletedChats.length };
  }),
});

export type ChatRouter = typeof chatRouter;
