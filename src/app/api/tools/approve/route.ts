import { z } from "zod";

import { callRovoTool } from "@/lib/rovo-mcp";
import { nowIso } from "@/lib/ids";
import { updateData } from "@/lib/store";

export const dynamic = "force-dynamic";

const approveSchema = z.object({
  invocationId: z.string(),
  decision: z.enum(["approve", "reject"]),
});

export async function POST(request: Request) {
  const body = approveSchema.parse(await request.json());
  const now = nowIso();
  const result = await updateData(async (data) => {
    const invocation = data.toolInvocations.find((item) => item.id === body.invocationId);
    if (!invocation) {
      return null;
    }

    if (body.decision === "reject") {
      invocation.status = "rejected";
      invocation.output = { message: "User rejected this write action." };
      invocation.updatedAt = now;
      return invocation;
    }

    invocation.status = "running";
    invocation.approvedAt = now;
    invocation.updatedAt = now;
    const input = invocation.input as Record<string, unknown>;
    const action = String(input.action ?? invocation.toolName);
    const payload =
      input.payload && typeof input.payload === "object" ? (input.payload as Record<string, unknown>) : {};
    const rovoResult = await callRovoTool(action, payload);
    invocation.status = rovoResult.ok ? "success" : "error";
    invocation.output = rovoResult;
    invocation.updatedAt = nowIso();
    return invocation;
  });

  if (!result) {
    return Response.json({ error: "Tool invocation not found" }, { status: 404 });
  }

  return Response.json({ invocation: result });
}

