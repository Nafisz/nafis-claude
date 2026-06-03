import path from "node:path";

import type { RuntimeStatus } from "@/lib/types";

export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
export const ROVO_MCP_ENDPOINT = "https://mcp.atlassian.com/v1/mcp/authv2";

export function getClaudeModel() {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function getDataDir() {
  return process.env.APP_DATA_DIR
    ? path.resolve(process.env.APP_DATA_DIR)
    : path.join(process.cwd(), "data");
}

export function getRuntimeStatus(): RuntimeStatus {
  const atlassianEnabled = process.env.ATLASSIAN_MCP_ENABLED === "true";

  return {
    claude: {
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      model: getClaudeModel(),
    },
    atlassian: {
      enabled: atlassianEnabled,
      endpoint: ROVO_MCP_ENDPOINT,
      command: `npx -y mcp-remote@latest ${ROVO_MCP_ENDPOINT}`,
      status: atlassianEnabled ? "configured" : "disabled",
      message: atlassianEnabled
        ? "Atlassian MCP is enabled. OAuth may still need to be completed by mcp-remote."
        : "Set ATLASSIAN_MCP_ENABLED=true after completing mcp-remote OAuth setup.",
    },
    storage: {
      dataDir: getDataDir(),
    },
  };
}

