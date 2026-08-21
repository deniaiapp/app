import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { chatShareRecipients, chatShares, chats, user } from "@/db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const shareRouter = router({
  createShare: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        visibility: z.enum(["public", "private"]).default("public"),
        allowFork: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [chat] = await ctx.db
        .select()
        .from(chats)
        .where(and(eq(chats.id, input.chatId), eq(chats.uid, ctx.userId)));

      if (!chat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
      }

      const [existingShare] = await ctx.db
        .select()
        .from(chatShares)
        .where(eq(chatShares.chatId, input.chatId));

      if (existingShare) {
        const [updated] = await ctx.db
          .update(chatShares)
          .set({
            visibility: input.visibility,
            allowFork: input.allowFork,
            updatedAt: new Date(),
          })
          .where(eq(chatShares.id, existingShare.id))
          .returning();
        return updated;
      }

      const [newShare] = await ctx.db
        .insert(chatShares)
        .values({
          chatId: input.chatId,
          ownerId: ctx.userId,
          visibility: input.visibility,
          allowFork: input.allowFork,
        })
        .returning();

      return newShare;
    }),

  getShareSettings: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [share] = await ctx.db
        .select()
        .from(chatShares)
        .where(and(eq(chatShares.chatId, input.chatId), eq(chatShares.ownerId, ctx.userId)));

      if (!share) return null;

      const recipients =
        share.visibility === "private"
          ? await ctx.db
              .select({ id: user.id, name: user.name, email: user.email })
              .from(chatShareRecipients)
              .innerJoin(user, eq(chatShareRecipients.recipientId, user.id))
              .where(eq(chatShareRecipients.shareId, share.id))
          : [];

      return { ...share, recipients };
    }),

  deleteShare: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(chatShares)
        .where(and(eq(chatShares.chatId, input.chatId), eq(chatShares.ownerId, ctx.userId)))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
      }
      return deleted;
    }),

  addRecipient: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        recipientEmail: z.email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [share] = await ctx.db
        .select()
        .from(chatShares)
        .where(and(eq(chatShares.chatId, input.chatId), eq(chatShares.ownerId, ctx.userId)));

      if (!share) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
      }

      const [recipient] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.email, input.recipientEmail));

      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (recipient.id === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot share with yourself",
        });
      }

      const [existing] = await ctx.db
        .select()
        .from(chatShareRecipients)
        .where(
          and(
            eq(chatShareRecipients.shareId, share.id),
            eq(chatShareRecipients.recipientId, recipient.id),
          ),
        );

      if (existing) {
        return existing;
      }

      const [newRecipient] = await ctx.db
        .insert(chatShareRecipients)
        .values({
          shareId: share.id,
          recipientId: recipient.id,
        })
        .onConflictDoNothing({
          target: [chatShareRecipients.shareId, chatShareRecipients.recipientId],
        })
        .returning();

      if (newRecipient) {
        return newRecipient;
      }

      const [createdRecipient] = await ctx.db
        .select()
        .from(chatShareRecipients)
        .where(
          and(
            eq(chatShareRecipients.shareId, share.id),
            eq(chatShareRecipients.recipientId, recipient.id),
          ),
        );

      return createdRecipient;
    }),

  removeRecipient: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        recipientId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [share] = await ctx.db
        .select()
        .from(chatShares)
        .where(and(eq(chatShares.chatId, input.chatId), eq(chatShares.ownerId, ctx.userId)));

      if (!share) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
      }

      await ctx.db
        .delete(chatShareRecipients)
        .where(
          and(
            eq(chatShareRecipients.shareId, share.id),
            eq(chatShareRecipients.recipientId, input.recipientId),
          ),
        );

      return { success: true };
    }),

  getSharedChat: publicProcedure
    .input(z.object({ shareId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [share] = await ctx.db
        .select()
        .from(chatShares)
        .where(eq(chatShares.id, input.shareId));

      if (!share) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared chat not found",
        });
      }

      if (share.visibility === "private") {
        const userId = ctx.session?.session?.userId;
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Login required",
          });
        }

        if (userId !== share.ownerId) {
          const [recipient] = await ctx.db
            .select()
            .from(chatShareRecipients)
            .where(
              and(
                eq(chatShareRecipients.shareId, share.id),
                eq(chatShareRecipients.recipientId, userId),
              ),
            );

          if (!recipient) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied",
            });
          }
        }
      }

      const [chat] = await ctx.db.select().from(chats).where(eq(chats.id, share.chatId));

      if (!chat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat no longer exists",
        });
      }

      const [owner] = await ctx.db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, share.ownerId));

      return {
        share,
        chat,
        owner,
      };
    }),

  forkChat: protectedProcedure
    .input(z.object({ shareId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [share] = await ctx.db
        .select()
        .from(chatShares)
        .where(eq(chatShares.id, input.shareId));

      if (!share) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared chat not found",
        });
      }

      if (!share.allowFork) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Forking not allowed",
        });
      }

      if (share.visibility === "private") {
        if (ctx.userId !== share.ownerId) {
          const [recipient] = await ctx.db
            .select()
            .from(chatShareRecipients)
            .where(
              and(
                eq(chatShareRecipients.shareId, share.id),
                eq(chatShareRecipients.recipientId, ctx.userId),
              ),
            );

          if (!recipient) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Access denied",
            });
          }
        }
      }

      const [originalChat] = await ctx.db.select().from(chats).where(eq(chats.id, share.chatId));

      if (!originalChat) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Original chat not found",
        });
      }

      const [forkedChat] = await ctx.db
        .insert(chats)
        .values({
          uid: ctx.userId,
          title: `${originalChat.title || "Untitled"} (Forked)`,
          messages: originalChat.messages,
        })
        .returning();

      return forkedChat;
    }),

  getSharedWithMe: protectedProcedure.query(async ({ ctx }) => {
    const sharedChats = await ctx.db
      .select({
        share: chatShares,
        chat: chats,
        owner: {
          id: user.id,
          name: user.name,
          image: user.image,
        },
      })
      .from(chatShareRecipients)
      .innerJoin(chatShares, eq(chatShareRecipients.shareId, chatShares.id))
      .innerJoin(chats, eq(chatShares.chatId, chats.id))
      .innerJoin(user, eq(chatShares.ownerId, user.id))
      .where(eq(chatShareRecipients.recipientId, ctx.userId));

    return sharedChats;
  }),

  getMyShares: protectedProcedure.query(async ({ ctx }) => {
    const myShares = await ctx.db
      .select({
        share: chatShares,
        chat: {
          id: chats.id,
          title: chats.title,
        },
      })
      .from(chatShares)
      .innerJoin(chats, eq(chatShares.chatId, chats.id))
      .where(eq(chatShares.ownerId, ctx.userId));

    // Collect private share IDs to fetch recipients in a single query
    const privateShareIds: string[] = [];
    for (const item of myShares) {
      if (item.share.visibility === "private") {
        privateShareIds.push(item.share.id);
      }
    }

    const allRecipients =
      privateShareIds.length > 0
        ? await ctx.db
            .select({
              shareId: chatShareRecipients.shareId,
              id: user.id,
              name: user.name,
              email: user.email,
            })
            .from(chatShareRecipients)
            .innerJoin(user, eq(chatShareRecipients.recipientId, user.id))
            .where(inArray(chatShareRecipients.shareId, privateShareIds))
        : [];

    // Group recipients by shareId
    const recipientsByShareId = new Map<string, { id: string; name: string; email: string }[]>();
    for (const r of allRecipients) {
      const list = recipientsByShareId.get(r.shareId) ?? [];
      list.push({ id: r.id, name: r.name ?? "", email: r.email });
      recipientsByShareId.set(r.shareId, list);
    }

    const sharesWithRecipients = myShares.map((item) => ({
      ...item,
      recipients: recipientsByShareId.get(item.share.id) ?? [],
    }));

    return sharesWithRecipients;
  }),
});

export type ShareRouter = typeof shareRouter;
