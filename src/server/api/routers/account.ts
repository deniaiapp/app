import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { securityActivity } from "@/db/schema";
import { buildAccountExport } from "@/lib/account-export";
import { recordSecurityActivity } from "@/lib/security-activity";
import { protectedProcedure, router } from "../trpc";
import { historyBefore, historyCursorSchema, historyCursorTimestamp } from "../history-pagination";

export const accountRouter = router({
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    const [lastExport] = await ctx.db
      .select({ createdAt: securityActivity.createdAt })
      .from(securityActivity)
      .where(
        and(eq(securityActivity.userId, ctx.userId), eq(securityActivity.action, "data_exported")),
      )
      .orderBy(desc(securityActivity.createdAt))
      .limit(1);

    if (lastExport && Date.now() - lastExport.createdAt.getTime() < 60_000) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Please wait a minute before exporting again.",
      });
    }

    const payload = await buildAccountExport(ctx.userId);
    await recordSecurityActivity({
      userId: ctx.userId,
      action: "data_exported",
      ipAddress: ctx.session?.session.ipAddress ?? null,
      userAgent: ctx.session?.session.userAgent ?? null,
    });
    return payload;
  }),

  securityActivity: protectedProcedure
    .input(
      z
        .object({
          cursor: historyCursorSchema.optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;

      const rows = await ctx.db
        .select({
          id: securityActivity.id,
          action: securityActivity.action,
          ipAddress: securityActivity.ipAddress,
          userAgent: securityActivity.userAgent,
          createdAt: securityActivity.createdAt,
          cursorCreatedAt: historyCursorTimestamp(securityActivity.createdAt),
        })
        .from(securityActivity)
        .where(
          and(eq(securityActivity.userId, ctx.userId), historyBefore(securityActivity, cursor)),
        )
        .orderBy(desc(securityActivity.createdAt), desc(securityActivity.id))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      const last = page.at(-1);

      return {
        items: page.map(({ cursorCreatedAt, ...item }) => {
          void cursorCreatedAt;
          return item;
        }),
        nextCursor:
          rows.length > limit && last ? { createdAt: last.cursorCreatedAt, id: last.id } : null,
      };
    }),
});
