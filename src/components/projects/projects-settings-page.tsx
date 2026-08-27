"use client";

import { Archive, ArchiveRestore, ExternalLink, FolderKanban, Plus, Trash2 } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc/react";

const projectColorClass: Record<string, string> = {
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  archivedAt: Date | null;
};

function ProjectListRow({
  project,
  archived,
  onArchive,
  onRestore,
  onDelete,
  pending,
}: {
  project: ProjectRow;
  archived: boolean;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const t = useExtracted();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/30">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`size-2.5 shrink-0 rounded-full ${projectColorClass[project.color] ?? "bg-amber-500"}`}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{project.name}</div>
          {project.description ? (
            <div className="truncate text-xs text-muted-foreground">{project.description}</div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="size-3.5" />
            {t("Open")}
          </Link>
        </Button>
        {archived ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onRestore(project.id)}
            >
              <ArchiveRestore className="size-3.5" />
              {t("Restore")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={t("Delete project")}
              disabled={pending}
              onClick={() => {
                if (!window.confirm(t("Permanently delete this project?"))) return;
                onDelete(project.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={t("Archive project")}
            disabled={pending}
            onClick={() => onArchive(project.id)}
          >
            <Archive className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProjectsSettingsPage() {
  const t = useExtracted();
  const { push } = useRouter();
  const utils = trpc.useUtils();
  const projectsQuery = trpc.projects.list.useQuery({ includeArchived: true });

  const invalidate = async () => {
    await utils.projects.list.invalidate();
  };

  const createProject = trpc.projects.create.useMutation({
    onSuccess: async (project) => {
      await invalidate();
      if (project?.id) {
        push(`/projects/${project.id}`);
      }
    },
  });

  const archiveProject = trpc.projects.archive.useMutation({
    onSuccess: () => {
      void invalidate();
    },
  });

  const restoreProject = trpc.projects.restore.useMutation({
    onSuccess: () => {
      void invalidate();
    },
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      void invalidate();
    },
  });

  const handleCreateProject = () => {
    createProject.mutate({
      name: t("New project"),
      description: null,
      instructions: "",
      color: "amber",
    });
  };

  const allProjects = projectsQuery.data ?? [];
  const activeProjects = allProjects.filter((project) => !project.archivedAt);
  const archivedProjects = allProjects.filter((project) => project.archivedAt);
  const pending = archiveProject.isPending || restoreProject.isPending || deleteProject.isPending;

  return (
    <SettingsPageShell title={t("Projects")}>
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="size-4" />
                {t("Projects")}
              </CardTitle>
              <CardDescription>
                {t("Organize chats with custom instructions and knowledge files.")}
              </CardDescription>
            </div>
            <Button onClick={handleCreateProject} disabled={createProject.isPending}>
              {createProject.isPending ? <Spinner /> : <Plus className="size-4" />}
              {t("New project")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {projectsQuery.isLoading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : activeProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("No projects yet. Create one to organize chats with custom context.")}
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.map((project) => (
                <ProjectListRow
                  key={project.id}
                  project={project}
                  archived={false}
                  pending={pending}
                  onArchive={(id) => archiveProject.mutate({ id })}
                  onRestore={(id) => restoreProject.mutate({ id })}
                  onDelete={(id) => deleteProject.mutate({ id })}
                />
              ))}
            </div>
          )}

          {archivedProjects.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{t("Archived")}</h2>
              {archivedProjects.map((project) => (
                <ProjectListRow
                  key={project.id}
                  project={project}
                  archived
                  pending={pending}
                  onArchive={(id) => archiveProject.mutate({ id })}
                  onRestore={(id) => restoreProject.mutate({ id })}
                  onDelete={(id) => deleteProject.mutate({ id })}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
