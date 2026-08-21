import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { chats, projectFiles, projects } from "@/db/schema";
import { protectedProcedure, router } from "../trpc";

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).nullable(),
  instructions: z.string().trim().max(4000),
  color: z.string().trim().min(1).max(32),
});

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(projects)
      .where(eq(projects.userId, ctx.userId))
      .orderBy(asc(projects.name));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select()
        .from(projects)
        .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
        .limit(1);

      if (!project) {
        return null;
      }

      const files = await ctx.db
        .select()
        .from(projectFiles)
        .where(and(eq(projectFiles.projectId, input.id), eq(projectFiles.userId, ctx.userId)))
        .orderBy(asc(projectFiles.createdAt));

      return { project, files };
    }),

  create: protectedProcedure.input(projectInputSchema).mutation(async ({ ctx, input }) => {
    const [project] = await ctx.db
      .insert(projects)
      .values({
        userId: ctx.userId,
        name: input.name,
        description: input.description ?? null,
        instructions: input.instructions,
        color: input.color,
      })
      .returning();

    return project;
  }),

  update: protectedProcedure
    .input(projectInputSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [project] = await ctx.db
        .update(projects)
        .set({
          ...fields,
          description: fields.description ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, id), eq(projects.userId, ctx.userId)))
        .returning();

      return project ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(projects)
        .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
        .returning();

      return deleted ?? null;
    }),

  listFiles: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(projectFiles)
        .where(
          and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.userId, ctx.userId)),
        )
        .orderBy(asc(projectFiles.createdAt));
    }),

  recordFile: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        filename: z.string().trim().min(1).max(255),
        url: z.url(),
        size: z.number().int().nonnegative(),
        mimeType: z.string().trim().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const [project] = await ctx.db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.userId, ctx.userId)))
        .limit(1);

      if (!project) {
        throw new Error("Project not found");
      }

      const [file] = await ctx.db
        .insert(projectFiles)
        .values({
          projectId: input.projectId,
          userId: ctx.userId,
          filename: input.filename,
          url: input.url,
          size: input.size,
          mimeType: input.mimeType,
        })
        .returning();

      return file;
    }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(projectFiles)
        .where(and(eq(projectFiles.id, input.id), eq(projectFiles.userId, ctx.userId)))
        .returning();

      return deleted ?? null;
    }),

  getProjectChats: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: chats.id,
          title: chats.title,
          created_at: chats.created_at,
          updated_at: chats.updated_at,
        })
        .from(chats)
        .where(and(eq(chats.projectId, input.projectId), eq(chats.uid, ctx.userId)))
        .orderBy(desc(chats.updated_at))
        .limit(100);
    }),
});

export type ProjectsRouter = typeof projectsRouter;
