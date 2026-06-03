import { z } from "zod";

import { nowIso } from "@/lib/ids";
import { updateData } from "@/lib/store";

export const dynamic = "force-dynamic";

const patchProjectSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).optional(),
  instructions: z.string().max(4000).optional(),
  archived: z.boolean().optional(),
  activeSkillIds: z.array(z.string()).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = patchProjectSchema.parse(await request.json());
  const project = await updateData((data) => {
    const item = data.projects.find((candidate) => candidate.id === id);
    if (!item) {
      return null;
    }
    Object.assign(item, body, { updatedAt: nowIso() });
    return item;
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json({ project });
}

