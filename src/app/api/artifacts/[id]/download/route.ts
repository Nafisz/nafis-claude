import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

function fileName(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact"}.md`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await readData();
  const artifact = data.artifacts.find((item) => item.id === id);

  if (!artifact) {
    return Response.json({ error: "Artifact not found" }, { status: 404 });
  }

  return new Response(artifact.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(artifact.title)}"`,
    },
  });
}

