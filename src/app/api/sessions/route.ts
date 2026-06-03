import { z } from "zod";

import { createSession } from "@/lib/store";

export const dynamic = "force-dynamic";

const createSessionSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  const body = createSessionSchema.parse(await request.json());
  const session = await createSession(body.projectId, body.title);
  return Response.json({ session });
}

