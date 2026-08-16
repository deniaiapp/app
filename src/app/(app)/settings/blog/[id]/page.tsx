import { BlogEditorPage } from "@/components/blog/blog-editor-page";

export default async function EditBlogPostRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogEditorPage postId={id} />;
}
