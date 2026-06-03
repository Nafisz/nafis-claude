import type { Tool } from "@anthropic-ai/sdk/resources/messages/messages";

import { callRovoTool } from "@/lib/rovo-mcp";
import {
  addArtifactToData,
  addMemoryToData,
  addToolInvocationToData,
  readData,
  updateData,
} from "@/lib/store";
import { createId, nowIso } from "@/lib/ids";
import type { AppData, Artifact, MemoryItem, ToolInvocation } from "@/lib/types";

export const LOCAL_TOOLS: Tool[] = [
  {
    name: "create_markdown_artifact",
    description:
      "Create or save a Markdown artifact for durable output. Use this for PRDs, notes, specs, summaries, and generated .md files.",
    input_schema: {
      type: "object",
      required: ["title", "content"],
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
    },
  },
  {
    name: "propose_memory",
    description:
      "Propose a durable memory. The user must approve it before it becomes active.",
    input_schema: {
      type: "object",
      required: ["scope", "type", "content"],
      properties: {
        scope: { type: "string", enum: ["global", "project"] },
        type: {
          type: "string",
          enum: ["preference", "fact", "decision", "terminology", "workflow", "constraint"],
        },
        content: { type: "string" },
      },
    },
  },
  {
    name: "search_local_sessions",
    description: "Search saved local sessions by title, summary, and message content.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
    },
  },
  {
    name: "read_uploaded_file",
    description: "Read the stored text preview of an uploaded file by file_id.",
    input_schema: {
      type: "object",
      required: ["file_id"],
      properties: {
        file_id: { type: "string" },
      },
    },
  },
  {
    name: "atlassian_search",
    description:
      "Search Jira or Confluence through Atlassian Rovo MCP. Read-only. Requires mcp-remote OAuth setup.",
    input_schema: {
      type: "object",
      required: ["query", "target"],
      properties: {
        target: { type: "string", enum: ["jira", "confluence", "all"] },
        query: { type: "string" },
      },
    },
  },
  {
    name: "atlassian_write_request",
    description:
      "Prepare a Jira or Confluence write. This never executes immediately; it creates a pending approval card.",
    input_schema: {
      type: "object",
      required: ["target", "action", "payload"],
      properties: {
        target: { type: "string", enum: ["jira", "confluence"] },
        action: { type: "string" },
        payload: { type: "object" },
      },
    },
  },
];

export interface ToolRunContext {
  data: AppData;
  sessionId: string;
  projectId: string;
  messageId: string | null;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

export async function runTool(name: string, input: unknown, context: ToolRunContext) {
  const args = asRecord(input);
  const now = nowIso();

  if (name === "create_markdown_artifact") {
    const title = String(args.title ?? "Generated Markdown");
    const content = String(args.content ?? "");
    const artifact = await updateData((data) => {
      const item: Artifact = {
        id: createId("art"),
        projectId: context.projectId,
        sessionId: context.sessionId,
        createdByMessageId: context.messageId,
        title,
        type: "markdown",
        content,
        version: 1,
        status: "saved",
        createdAt: now,
        updatedAt: now,
      };
      addArtifactToData(data, item);
      return item;
    });
    const result = { artifact, message: `Markdown artifact saved as ${artifact.title}.` };
    const invocation = await recordTool(context, {
      provider: "local",
      toolName: name,
      input,
      output: result,
      status: "success",
      requiresApproval: false,
    });
    return { ...result, invocationId: invocation.id };
  }

  if (name === "propose_memory") {
    const memory = await updateData((data) => {
      const scope = args.scope === "global" ? "global" : "project";
      const item: MemoryItem = {
        id: createId("mem"),
        projectId: scope === "project" ? context.projectId : null,
        scope,
        type:
          args.type === "fact" ||
          args.type === "decision" ||
          args.type === "terminology" ||
          args.type === "workflow" ||
          args.type === "constraint"
            ? args.type
            : "preference",
        content: String(args.content ?? ""),
        status: "pending",
        sourceSessionId: context.sessionId,
        createdAt: now,
        updatedAt: now,
      };
      addMemoryToData(data, item);
      return item;
    });
    const result = { memory, message: "Memory proposed and waiting for user approval." };
    const invocation = await recordTool(context, {
      provider: "local",
      toolName: name,
      input,
      output: result,
      status: "success",
      requiresApproval: false,
    });
    return { ...result, invocationId: invocation.id };
  }

  if (name === "search_local_sessions") {
    const query = String(args.query ?? "").toLowerCase();
    const data = await readData();
    const results = data.sessions
      .map((session) => {
        const text = [
          session.title,
          session.summary,
          ...data.messages
            .filter((message) => session.messageIds.includes(message.id))
            .map((message) => message.content),
        ]
          .join("\n")
          .toLowerCase();
        return { session, matched: query ? text.includes(query) : false };
      })
      .filter((item) => item.matched)
      .slice(0, 8)
      .map(({ session }) => ({ id: session.id, title: session.title, updatedAt: session.updatedAt }));
    const result = { results };
    const invocation = await recordTool(context, {
      provider: "local",
      toolName: name,
      input,
      output: result,
      status: "success",
      requiresApproval: false,
    });
    return { ...result, invocationId: invocation.id };
  }

  if (name === "read_uploaded_file") {
    const fileId = String(args.file_id ?? "");
    const data = await readData();
    const file = data.files.find((item) => item.id === fileId);
    const result = file
      ? { file: { id: file.id, name: file.name, mimeType: file.mimeType, preview: file.textPreview } }
      : { error: `File ${fileId} was not found.` };
    const invocation = await recordTool(context, {
      provider: "local",
      toolName: name,
      input,
      output: result,
      status: file ? "success" : "error",
      requiresApproval: false,
    });
    return { ...result, invocationId: invocation.id };
  }

  if (name === "atlassian_search") {
    const target = String(args.target ?? "all");
    const query = String(args.query ?? "");
    const result = await callRovoTool("search", { query, target });
    const invocation = await recordTool(context, {
      provider: "atlassian",
      toolName: name,
      input,
      output: result,
      status: result.ok ? "success" : "error",
      requiresApproval: false,
    });
    return { ...result, invocationId: invocation.id };
  }

  if (name === "atlassian_write_request") {
    const invocation = await recordTool(context, {
      provider: "atlassian",
      toolName: name,
      input,
      output: {
        message:
          "Write action is pending user approval. Nothing has been changed in Jira or Confluence yet.",
      },
      status: "pending_approval",
      requiresApproval: true,
    });
    return {
      approvalRequired: true,
      invocationId: invocation.id,
      message: "Created a pending approval card for this Atlassian write request.",
    };
  }

  return { error: `Unknown tool: ${name}` };
}

async function recordTool(
  context: ToolRunContext,
  params: Pick<
    ToolInvocation,
    "provider" | "toolName" | "input" | "output" | "status" | "requiresApproval"
  >,
) {
  const now = nowIso();
  return updateData((data) => {
    const invocation: ToolInvocation = {
      id: createId("tool"),
      sessionId: context.sessionId,
      messageId: context.messageId,
      provider: params.provider,
      toolName: params.toolName,
      input: params.input,
      output: params.output,
      status: params.status,
      requiresApproval: params.requiresApproval,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    addToolInvocationToData(data, invocation);
    return invocation;
  });
}
