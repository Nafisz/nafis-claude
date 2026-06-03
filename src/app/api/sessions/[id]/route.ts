import { findSession, readData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await readData();
  const session = findSession(data, id);
  if (!session || session.id !== id) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({
    session,
    messages: data.messages.filter((message) => session.messageIds.includes(message.id)),
    files: data.files.filter((file) => session.fileIds.includes(file.id)),
    artifacts: data.artifacts.filter((artifact) => session.artifactIds.includes(artifact.id)),
    toolInvocations: data.toolInvocations.filter((tool) => tool.sessionId === session.id),
  });
}

