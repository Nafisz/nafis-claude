import { z } from "zod";

import { createProject } from "@/lib/store";

export const dynamic = "force-dynamic";

const createProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).default(""),
  instructions: z.string().max(4000).default(""),
});

export async function POST(request: Request) {
  const body = createProjectSchema.parse(await request.json());
  const project = await createProject(body);
  return Response.json({ project });
}

