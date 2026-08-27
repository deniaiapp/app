import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProjectPage } from "@/components/projects/project-page";
import { Spinner } from "@/components/ui/spinner";
import { db } from "@/db/drizzle";
import { getSession } from "@/lib/get-session";
import { getAccessibleProject } from "@/lib/project-access";

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
};

function ProjectPageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-5" />
    </div>
  );
}

async function ProjectDetailContent({ params }: ProjectDetailPageProps) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  if (!session?.user) {
    notFound();
  }

  const project = await getAccessibleProject(db, session.user.id, id);
  if (!project) {
    notFound();
  }

  return <ProjectPage projectId={id} initialProjectName={project.name} />;
}

export default function ProjectDetailPage(props: ProjectDetailPageProps) {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <ProjectDetailContent {...props} />
    </Suspense>
  );
}
