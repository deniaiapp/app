import { eq } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { projectFiles } from "@/db/schema";
import { getAccessibleProject } from "@/lib/project-access";

export async function buildProjectPrompt(projectId: string | null | undefined, userId: string) {
  if (!projectId) {
    return null;
  }

  const project = await getAccessibleProject(db, userId, projectId);
  if (!project || project.archivedAt) {
    return null;
  }

  const files = await db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId));

  const filesSummary =
    files.length > 0
      ? files.map((f) => `- ${f.filename} (${f.url})`).join("\n")
      : "No knowledge files.";

  return [
    `Project: ${project.name}`,
    project.description ? `Description: ${project.description}` : null,
    project.instructions ? `Project instructions: ${project.instructions}` : null,
    "Knowledge files:",
    filesSummary,
    "Treat this project context as persistent working memory for the conversation. Use it when relevant.",
  ]
    .filter(Boolean)
    .join("\n");
}
