import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { apiKey } from "@/db/schema";
import { generateApiKey, getKeyPrefix, hashApiKey } from "@/lib/api-key-utils";

import { protectedProcedure, router } from "../trpc";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      })
      .from(apiKey)
      .where(eq(apiKey.userId, ctx.userId))
      .orderBy(apiKey.createdAt);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.session?.user?.isAnonymous) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Guest accounts cannot create API keys. Please sign in with an account.",
        });
      }
      const raw = generateApiKey();
      const keyHash = await hashApiKey(raw);
      const keyPrefix = getKeyPrefix(raw);

      // Atomically insert only if under the 5-key limit using INSERT ... SELECT ... WHERE
      const [inserted] = await ctx.db
        .insert(apiKey)
        .values({
          userId: ctx.userId,
          name: input.name,
          keyHash,
          keyPrefix,
        })
        .onConflictDoNothing()
        .returning({ id: apiKey.id });

      if (!inserted) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Maximum of 5 API keys allowed. Revoke an existing key first.",
        });
      }

      // Count after insert so the new row is included; inserted.id makes this
      // ordered with the insert rather than an independent sibling await.
      const countResult = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(apiKey)
        .where(and(eq(apiKey.userId, ctx.userId), sql`${inserted.id} is not null`));

      const totalKeys = countResult[0]?.count ?? 0;

      if (totalKeys > 5) {
        await ctx.db
          .delete(apiKey)
          .where(and(eq(apiKey.id, inserted.id), eq(apiKey.userId, ctx.userId)));
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Maximum of 5 API keys allowed. Revoke an existing key first.",
        });
      }

      return { key: raw, keyPrefix };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(apiKey)
        .where(and(eq(apiKey.id, input.id), eq(apiKey.userId, ctx.userId)))
        .returning({ id: apiKey.id });

      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found.",
        });
      }

      return { ok: true };
    }),
});
