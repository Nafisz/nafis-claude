import { z } from "zod";

import { createId, nowIso } from "@/lib/ids";
import { addArtifactToData, updateData } from "@/lib/store";
import type { Artifact } from "@/lib/types";

export const dynamic = "force-dynamic";

const artifactSchema = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  sessionId: z.string(),
  title: z.string().min(1).max(120),
  content: z.string(),
});

export async function POST(request: Request) {
  const body = artifactSchema.parse(await request.json());
  const now = nowIso();
  const artifact = await updateData((data) => {
    if (body.id) {
      const existing = data.artifacts.find((item) => item.id === body.id);
      if (existing) {
        existing.title = body.title;
        existing.content = body.content;
        existing.version += 1;
        existing.updatedAt = now;
        return existing;
      }
    }

    const item: Artifact = {
      id: createId("art"),
      projectId: body.projectId,
      sessionId: body.sessionId,
      createdByMessageId: null,
      title: body.title,
      type: "markdown",
      content: body.content,
      version: 1,
      status: "saved",
      createdAt: now,
      updatedAt: now,
    };
    addArtifactToData(data, item);
    return item;
  });

  return Response.json({ artifact });
}

