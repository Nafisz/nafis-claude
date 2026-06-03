import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { ROVO_MCP_ENDPOINT } from "@/lib/env";

type RovoResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; setup: string };

function disabledResult(): RovoResult {
  return {
    ok: false,
    error: "Atlassian MCP is not enabled.",
    setup:
      "Run mcp-remote OAuth locally, then set ATLASSIAN_MCP_ENABLED=true. Command: npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function createRovoClient() {
  const client = new Client(
    {
      name: "claude-like-local-workspace",
      version: "0.1.0",
    },
    {
      capabilities: {},
    },
  );

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "mcp-remote@latest", ROVO_MCP_ENDPOINT],
  });

  await client.connect(transport);
  return { client, transport };
}

export async function listRovoTools(): Promise<RovoResult> {
  if (process.env.ATLASSIAN_MCP_ENABLED !== "true") {
    return disabledResult();
  }

  let handle: Awaited<ReturnType<typeof createRovoClient>> | null = null;
  try {
    handle = await withTimeout(createRovoClient(), 15000, "Rovo MCP connect");
    const tools = await withTimeout(handle.client.listTools(), 10000, "Rovo MCP listTools");
    return { ok: true, data: tools };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown MCP error.",
      setup:
        "If this is the first run, execute the mcp-remote command in a terminal and complete Atlassian OAuth.",
    };
  } finally {
    await handle?.client.close().catch(() => undefined);
  }
}

export async function callRovoTool(name: string, args: Record<string, unknown>): Promise<RovoResult> {
  if (process.env.ATLASSIAN_MCP_ENABLED !== "true") {
    return disabledResult();
  }

  let handle: Awaited<ReturnType<typeof createRovoClient>> | null = null;
  try {
    handle = await withTimeout(createRovoClient(), 15000, "Rovo MCP connect");
    const result = await withTimeout(
      handle.client.callTool({ name, arguments: args }),
      20000,
      `Rovo MCP call ${name}`,
    );
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown MCP error.",
      setup:
        "Rovo MCP call failed. Verify mcp-remote OAuth, Atlassian permissions, and ATLASSIAN_MCP_ENABLED=true.",
    };
  } finally {
    await handle?.client.close().catch(() => undefined);
  }
}

