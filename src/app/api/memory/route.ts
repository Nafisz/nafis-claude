import { z } from "zod";

import { createId, nowIso } from "@/lib/ids";
import { addMemoryToData, updateData } from "@/lib/store";
import type { MemoryItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const memorySchema = z.object({
  id: z.string().optional(),
  action: z.enum(["create", "approve", "disable", "delete"]).default("create"),
  projectId: z.string().nullable().optional(),
  scope: z.enum(["global", "project"]).default("project"),
  type: z
    .enum(["preference", "fact", "decision", "terminology", "workflow", "constraint"])
    .default("fact"),
  content: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const body = memorySchema.parse(await request.json());
  const result = await updateData((data) => {
    const now = nowIso();

    if (body.action === "create") {
      const memory: MemoryItem = {
        id: createId("mem"),
        projectId: body.scope === "project" ? body.projectId ?? null : null,
        scope: body.scope,
        type: body.type,
        content: body.content ?? "",
        status: "active",
        sourceSessionId: null,
        createdAt: now,
        updatedAt: now,
      };
      addMemoryToData(data, memory);
      return memory;
    }

    const memory = data.memories.find((item) => item.id === body.id);
    if (!memory) {
      return null;
    }

    if (body.action === "approve") {
      memory.status = "active";
    }
    if (body.action === "disable") {
      memory.status = "disabled";
    }
    if (body.action === "delete") {
      data.memories = data.memories.filter((item) => item.id !== body.id);
    }
    memory.updatedAt = now;
    return memory;
  });

  if (!result && body.action !== "delete") {
    return Response.json({ error: "Memory not found" }, { status: 404 });
  }

  return Response.json({ memory: result });
}

