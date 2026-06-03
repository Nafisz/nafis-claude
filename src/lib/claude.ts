import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  MessageParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";

import { buildAnthropicMessages, buildSystemPrompt, sessionMessages } from "@/lib/context";
import { getClaudeModel } from "@/lib/env";
import { createId, nowIso } from "@/lib/ids";
import {
  addMessageToData,
  findProject,
  findSession,
  readData,
  updateData,
} from "@/lib/store";
import { LOCAL_TOOLS, runTool } from "@/lib/tools";
import type { AppData, ChatMessage, Project } from "@/lib/types";

type SendEvent = (event: string, payload: unknown) => void;
type ClaudeStream = ReturnType<InstanceType<typeof Anthropic>["messages"]["stream"]>;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

function configuredApiSkills(data: AppData, project: Project) {
  const storeSkills = data.skills
    .filter((skill) => skill.enabled && project.activeSkillIds.includes(skill.id) && skill.apiSkill)
    .map((skill) => skill.apiSkill);

  let envSkills: unknown[] = [];
  if (process.env.ANTHROPIC_API_SKILLS_JSON) {
    try {
      const parsed = JSON.parse(process.env.ANTHROPIC_API_SKILLS_JSON);
      envSkills = Array.isArray(parsed) ? parsed : [];
    } catch {
      envSkills = [];
    }
  }

  return [...storeSkills, ...envSkills]
    .filter((skill): skill is { skill_id: string; type: "anthropic" | "custom"; version?: string } => {
      if (!skill || typeof skill !== "object") {
        return false;
      }
      const candidate = skill as Record<string, unknown>;
      return (
        typeof candidate.skill_id === "string" &&
        (candidate.type === "anthropic" || candidate.type === "custom")
      );
    })
    .map((skill) => ({
      skill_id: skill.skill_id,
      type: skill.type,
      version: skill.version || "latest",
    }));
}

function textFromContent(content: ContentBlock[]) {
  return content
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function toolUses(content: ContentBlock[]) {
  return content.filter((block): block is ToolUseBlock => block.type === "tool_use");
}

export async function appendUserMessage(input: {
  sessionId: string;
  projectId: string;
  content: string;
  fileIds: string[];
}) {
  return updateData((data) => {
    const now = nowIso();
    const message: ChatMessage = {
      id: createId("msg"),
      sessionId: input.sessionId,
      role: "user",
      content: input.content,
      fileIds: input.fileIds,
      toolInvocationIds: [],
      createdAt: now,
    };
    addMessageToData(data, message);

    const session = data.sessions.find((item) => item.id === input.sessionId);
    if (session && input.fileIds.length) {
      session.fileIds = Array.from(new Set([...session.fileIds, ...input.fileIds]));
    }

    return message;
  });
}

export async function runAssistantTurn(input: {
  sessionId: string;
  projectId: string;
  model?: string;
  toolsEnabled: boolean;
  send: SendEvent;
}) {
  const client = getClient();
  const model = input.model?.trim() || getClaudeModel();

  if (!client) {
    const fallback =
      "ANTHROPIC_API_KEY is not configured. Add it to .env.local, restart npm run dev, then this workspace will send messages to Claude API. Local project, memory, file, session, and Markdown artifact features are still available.";
    input.send("delta", { text: fallback });
    const assistant = await saveAssistantMessage({
      sessionId: input.sessionId,
      model,
      content: fallback,
      toolInvocationIds: [],
    });
    input.send("done", { message: assistant });
    return;
  }

  const data = await readData();
  const project = findProject(data, input.projectId);
  const session = findSession(data, input.sessionId);
  const history = sessionMessages(data, session);
  const system = buildSystemPrompt(data, project, session);
  const workingMessages = buildAnthropicMessages(history) as MessageParam[];
  const assistantTextParts: string[] = [];
  const toolInvocationIds: string[] = [];
  const apiSkills = configuredApiSkills(data, project);
  const useApiSkills =
    process.env.ANTHROPIC_ENABLE_API_SKILLS === "true" && apiSkills.length > 0;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const params = {
      model,
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 4096),
      system,
      messages: workingMessages,
      tools: input.toolsEnabled ? LOCAL_TOOLS : undefined,
    };
    const betaMessages = client.beta.messages as unknown as {
      stream: (body: unknown) => ClaudeStream;
    };
    const stream = useApiSkills
      ? betaMessages.stream({
          ...params,
          betas: ["skills-2025-10-02"],
          container: { skills: apiSkills },
        })
      : client.messages.stream(params);

    stream.on("text", (text: string) => {
      assistantTextParts.push(text);
      input.send("delta", { text });
    });

    const finalMessage = await stream.finalMessage();
    const uses = toolUses(finalMessage.content as ContentBlock[]);
    workingMessages.push({
      role: "assistant",
      content: finalMessage.content,
    });

    if (!input.toolsEnabled || uses.length === 0) {
      break;
    }

    const toolResults = [];
    for (const toolUse of uses) {
      input.send("tool", {
        name: toolUse.name,
        input: toolUse.input,
        status: "running",
      });
      const result = await runTool(toolUse.name, toolUse.input, {
        data,
        sessionId: input.sessionId,
        projectId: project.id,
        messageId: null,
      });
      if (
        result &&
        typeof result === "object" &&
        "invocationId" in result &&
        typeof result.invocationId === "string"
      ) {
        toolInvocationIds.push(result.invocationId);
      }
      input.send("tool", {
        name: toolUse.name,
        input: toolUse.input,
        output: result,
        status: "success",
      });
      toolResults.push({
        type: "tool_result" as const,
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    workingMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  const dataAfterTools = await readData();
  const sessionAfterTools = findSession(dataAfterTools, input.sessionId);
  const newArtifacts = dataAfterTools.artifacts.filter((artifact) =>
    sessionAfterTools.artifactIds.includes(artifact.id),
  );
  const content =
    assistantTextParts.join("").trim() ||
    textFromContent((workingMessages.at(-1)?.content as ContentBlock[]) ?? []);

  const assistant = await saveAssistantMessage({
    sessionId: input.sessionId,
    model,
    content: content || "Done.",
    toolInvocationIds,
  });

  input.send("done", {
    message: assistant,
    artifacts: newArtifacts.slice(0, 6),
  });
}

async function saveAssistantMessage(input: {
  sessionId: string;
  model: string;
  content: string;
  toolInvocationIds: string[];
}) {
  return updateData((data) => {
    const now = nowIso();
    const message: ChatMessage = {
      id: createId("msg"),
      sessionId: input.sessionId,
      role: "assistant",
      content: input.content,
      model: input.model,
      fileIds: [],
      toolInvocationIds: input.toolInvocationIds,
      createdAt: now,
    };
    addMessageToData(data, message);
    return message;
  });
}
