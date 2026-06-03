import type { AppData, ChatMessage, ChatSession, Project } from "@/lib/types";

const MAX_HISTORY_MESSAGES = 24;
const MAX_FILE_PREVIEW_CHARS = 2800;

export function sessionMessages(data: AppData, session: ChatSession) {
  const ids = new Set(session.messageIds);
  return data.messages
    .filter((message) => ids.has(message.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function buildSystemPrompt(data: AppData, project: Project, session: ChatSession) {
  const memories = data.memories.filter(
    (memory) =>
      memory.status === "active" &&
      (memory.scope === "global" || memory.projectId === project.id),
  );

  const skills = data.skills.filter(
    (skill) => skill.enabled && project.activeSkillIds.includes(skill.id),
  );

  const files = data.files.filter((file) => session.fileIds.includes(file.id));

  return [
    "You are the assistant inside a local personal Claude-like workspace web app.",
    "Be direct, practical, and careful with user-owned project context.",
    "When a durable document is requested, prefer using create_markdown_artifact.",
    "When you learn a durable preference or project fact, use propose_memory instead of silently assuming it is permanent.",
    "Never claim Jira or Confluence writes were performed unless the tool result confirms success.",
    "",
    `Project: ${project.name}`,
    project.description ? `Project description: ${project.description}` : "",
    project.instructions ? `Project instructions:\n${project.instructions}` : "",
    memories.length
      ? `Active memory:\n${memories.map((memory) => `- [${memory.scope}/${memory.type}] ${memory.content}`).join("\n")}`
      : "Active memory: none.",
    skills.length
      ? `Enabled skills:\n${skills.map((skill) => `- ${skill.name} v${skill.version}: ${skill.instructions}`).join("\n")}`
      : "Enabled skills: none.",
    files.length
      ? `Attached file previews:\n${files
          .map(
            (file) =>
              `--- ${file.name} (${file.id}) ---\n${file.textPreview.slice(0, MAX_FILE_PREVIEW_CHARS)}`,
          )
          .join("\n\n")}`
      : "Attached file previews: none.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildAnthropicMessages(messages: ChatMessage[]) {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

