import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { securityActivity } from "@/db/schema";
import { buildAccountExport } from "@/lib/account-export";
import { recordSecurityActivity } from "@/lib/security-activity";
import { protectedProcedure, router } from "../trpc";

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
          cursor: z.string().datetime().optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor ? new Date(input.cursor) : undefined;

      const rows = await ctx.db
        .select({
          id: securityActivity.id,
          action: securityActivity.action,
          ipAddress: securityActivity.ipAddress,
          userAgent: securityActivity.userAgent,
          createdAt: securityActivity.createdAt,
        })
        .from(securityActivity)
        .where(
          and(
            eq(securityActivity.userId, ctx.userId),
            cursor ? lt(securityActivity.createdAt, cursor) : undefined,
          ),
        )
        .orderBy(desc(securityActivity.createdAt))
        .limit(limit + 1);

      const page = rows.slice(0, limit);
      const next = rows[limit];

      return {
        items: page,
        nextCursor: next ? next.createdAt.toISOString() : null,
      };
    }),
});
