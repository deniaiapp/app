import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { chats, projectFiles, projects } from "@/db/schema";
import {
  getAccessibleProject,
  listUserMemberships,
  projectAccessWhere,
  userIsOrgMember,
  withProjectAccess,
} from "@/lib/project-access";
import { protectedProcedure, router } from "../trpc";

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).nullable(),
  instructions: z.string().trim().max(4000),
  color: z.string().trim().min(1).max(32),
  defaultModel: z.string().trim().min(1).max(80).nullable().optional(),
});

async function requireAccessibleProject(
  ctx: { db: typeof import("@/db/drizzle").db; userId: string },
  projectId: string,
) {
  const project = await getAccessibleProject(ctx.db, ctx.userId, projectId);
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project;
}

async function requireManageableProject(
  ctx: { db: typeof import("@/db/drizzle").db; userId: string },
  projectId: string,
) {
  const project = await requireAccessibleProject(ctx, projectId);
  if (!project.canManage) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage this project.",
    });
  }
  return project;
}

export const projectsRouter = router({
  organizations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await listUserMemberships(ctx.db, ctx.userId);
    return memberships.map((entry) => ({
      id: entry.organizationId,
      name: entry.organizationName,
      role: entry.role,
    }));
  }),

  list: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const memberships = await listUserMemberships(ctx.db, ctx.userId);
      const organizationIds = memberships.map((entry) => entry.organizationId);
      const rows = await ctx.db
        .select()
        .from(projects)
        .where(projectAccessWhere(ctx.userId, organizationIds, Boolean(input?.includeArchived)))
        .orderBy(asc(projects.name));

      return rows
        .map((row) => withProjectAccess(row, ctx.userId, memberships))
        .filter((row): row is NonNullable<typeof row> => row !== null);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const project = await getAccessibleProject(ctx.db, ctx.userId, input.id);
      if (!project) {
        return null;
      }

      const files = await ctx.db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, input.id))
        .orderBy(asc(projectFiles.createdAt));

      return { project, files };
    }),

  create: protectedProcedure
    .input(projectInputSchema.extend({ organizationId: z.string().min(1).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = input.organizationId ?? null;
      if (organizationId && !(await userIsOrgMember(ctx.db, ctx.userId, organizationId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of that team.",
        });
      }

      const [project] = await ctx.db
        .insert(projects)
        .values({
          userId: ctx.userId,
          organizationId,
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
      await requireManageableProject(ctx, input.id);
      const { id, ...fields } = input;
      const [project] = await ctx.db
        .update(projects)
        .set({
          ...fields,
          description: fields.description ?? null,
          defaultModel: fields.defaultModel ?? null,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      return project ?? null;
    }),

  share: protectedProcedure
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireManageableProject(ctx, input.id);
      if (project.organizationId === input.organizationId) {
        return project;
      }
      if (!(await userIsOrgMember(ctx.db, ctx.userId, input.organizationId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of that team.",
        });
      }

      const [updated] = await ctx.db
        .update(projects)
        .set({ organizationId: input.organizationId, updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning();

      return updated ?? null;
    }),

  unshare: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireManageableProject(ctx, input.id);
      const [updated] = await ctx.db
        .update(projects)
        .set({ organizationId: null, updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning();

      return updated ?? null;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireManageableProject(ctx, input.id);
      const [project] = await ctx.db
        .update(projects)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning();

      return project ?? null;
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireManageableProject(ctx, input.id);
      const [project] = await ctx.db
        .update(projects)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning();

      return project ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireManageableProject(ctx, input.id);
      const [deleted] = await ctx.db.delete(projects).where(eq(projects.id, input.id)).returning();

      return deleted ?? null;
    }),

  listFiles: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireAccessibleProject(ctx, input.projectId);
      return ctx.db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, input.projectId))
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
      await requireAccessibleProject(ctx, input.projectId);

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
      const [file] = await ctx.db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.id, input.id))
        .limit(1);
      if (!file) {
        return null;
      }

      const project = await requireAccessibleProject(ctx, file.projectId);
      if (file.userId !== ctx.userId && !project.canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete files you uploaded.",
        });
      }

      const [deleted] = await ctx.db
        .delete(projectFiles)
        .where(eq(projectFiles.id, input.id))
        .returning();

      return deleted ?? null;
    }),

  getProjectChats: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireAccessibleProject(ctx, input.projectId);
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
