import { z } from "zod";
import { chats } from "@/db/schema";
import { normalizeMigrationPayload } from "@/lib/migration";
import { protectedProcedure, router } from "../trpc";

export const migrationRouter = router({
  import: protectedProcedure
    .input(
      z.object({
        payload: z.unknown().refine((val) => JSON.stringify(val).length <= 25_000_000, {
          message: "Payload too large (max 25 MB)",
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { conversations, warnings } = normalizeMigrationPayload(input.payload);

      if (!conversations.length) {
        return {
          success: false,
          importedChats: 0,
          importedMessages: 0,
          warnings,
          error: "No conversations found to import",
        };
      }

      const now = new Date();
      const values = conversations.map((conversation) => ({
        uid: ctx.userId,
        title: conversation.title,
        messages: structuredClone(conversation.messages),
        created_at: conversation.createdAt ?? now,
        updated_at: conversation.updatedAt ?? now,
      }));

      const inserted = await ctx.db.insert(chats).values(values).returning({
        id: chats.id,
      });

      return {
        success: true,
        importedChats: inserted.length,
        importedMessages: conversations.reduce(
          (count, conversation) => count + conversation.messages.length,
          0,
        ),
        warnings,
      };
    }),
});

export type MigrationRouter = typeof migrationRouter;
