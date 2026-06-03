import { getRuntimeStatus } from "@/lib/env";
import { listRovoTools } from "@/lib/rovo-mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ATLASSIAN_MCP_ENABLED !== "true") {
    return Response.json({
      status: getRuntimeStatus().atlassian,
      tools: [],
    });
  }

  const result = await listRovoTools();
  return Response.json({
    status: {
      ...getRuntimeStatus().atlassian,
      status: result.ok ? "configured" : "error",
      message: result.ok ? "Rovo MCP responded." : result.error,
    },
    tools: result.ok ? result.data : [],
    error: result.ok ? null : result,
  });
}

