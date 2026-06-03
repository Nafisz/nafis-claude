import { promises as fs } from "node:fs";
import path from "node:path";

import { getDataDir } from "@/lib/env";
import { createId, nowIso } from "@/lib/ids";
import type {
  AppData,
  Artifact,
  ChatMessage,
  ChatSession,
  MemoryItem,
  Project,
  Skill,
  StoredFile,
  ToolInvocation,
} from "@/lib/types";

const STORE_FILE = "store.json";

function storePath() {
  return path.join(getDataDir(), STORE_FILE);
}

function uploadsDir() {
  return path.join(getDataDir(), "uploads");
}

export function getUploadsDir() {
  return uploadsDir();
}

function seedData(): AppData {
  const now = nowIso();
  const projectId = createId("proj");
  const sessionId = createId("sess");
  const messageId = createId("msg");

  const project: Project = {
    id: projectId,
    name: "Personal Claude Workspace",
    description: "Workspace utama untuk chat Claude API, memory, file, skills, dan Atlassian tools.",
    instructions:
      "Bantu user bekerja secara praktis. Gunakan memory dan file project hanya saat relevan. Untuk aksi Jira/Confluence yang menulis data, minta approval terlebih dahulu.",
    archived: false,
    activeSkillIds: ["skill_prd_writer", "skill_atlassian_operator"],
    createdAt: now,
    updatedAt: now,
  };

  const session: ChatSession = {
    id: sessionId,
    projectId,
    title: "Welcome session",
    summary: "Initial seeded session.",
    messageIds: [messageId],
    artifactIds: [],
    fileIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const message: ChatMessage = {
    id: messageId,
    sessionId,
    role: "assistant",
    content:
      "Claude-like local workspace is ready. Add ANTHROPIC_API_KEY in .env.local, then start a chat, upload files, create memory, or generate a Markdown artifact.",
    fileIds: [],
    toolInvocationIds: [],
    createdAt: now,
  };

  const skills: Skill[] = [
    {
      id: "skill_prd_writer",
      name: "PRD Writer",
      description: "Structure requirements, acceptance criteria, risks, and milestones into Markdown.",
      version: "1.0.0",
      source: "local",
      instructions:
        "When the user asks for product requirements, produce concise PRDs with scope, requirements, risks, and acceptance criteria. Prefer Markdown artifacts for durable output.",
      enabled: true,
      apiSkill: null,
      createdAt: now,
    },
    {
      id: "skill_atlassian_operator",
      name: "Atlassian Operator",
      description: "Use Jira and Confluence carefully through approval-gated tool calls.",
      version: "1.0.0",
      source: "local",
      instructions:
        "Use Atlassian tools for searching and reading. For creating or updating Jira/Confluence, explain the proposed write and wait for approval.",
      enabled: true,
      apiSkill: null,
      createdAt: now,
    },
  ];

  return {
    projects: [project],
    sessions: [session],
    messages: [message],
    memories: [],
    files: [],
    skills,
    artifacts: [],
    toolInvocations: [],
  };
}

async function ensureDataFiles() {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.mkdir(uploadsDir(), { recursive: true });

  try {
    await fs.access(storePath());
  } catch {
    await writeData(seedData());
  }
}

export async function readData(): Promise<AppData> {
  await ensureDataFiles();
  const raw = await fs.readFile(storePath(), "utf8");
  const parsed = JSON.parse(raw) as Partial<AppData>;

  return {
    projects: parsed.projects ?? [],
    sessions: parsed.sessions ?? [],
    messages: parsed.messages ?? [],
    memories: parsed.memories ?? [],
    files: parsed.files ?? [],
    skills: parsed.skills ?? [],
    artifacts: parsed.artifacts ?? [],
    toolInvocations: parsed.toolInvocations ?? [],
  };
}

export async function writeData(data: AppData) {
  await fs.mkdir(getDataDir(), { recursive: true });
  const target = storePath();
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, target);
}

export async function updateData<T>(mutator: (data: AppData) => T | Promise<T>): Promise<T> {
  const data = await readData();
  const result = await mutator(data);
  await writeData(data);
  return result;
}

export function findProject(data: AppData, projectId: string) {
  return data.projects.find((project) => project.id === projectId && !project.archived) ?? data.projects[0];
}

export function findSession(data: AppData, sessionId: string) {
  return data.sessions.find((session) => session.id === sessionId) ?? data.sessions[0];
}

export async function createProject(input: Pick<Project, "name" | "description" | "instructions">) {
  return updateData((data) => {
    const now = nowIso();
    const project: Project = {
      id: createId("proj"),
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      archived: false,
      activeSkillIds: data.skills.filter((skill) => skill.enabled).map((skill) => skill.id),
      createdAt: now,
      updatedAt: now,
    };
    data.projects.unshift(project);
    return project;
  });
}

export async function createSession(projectId: string, title = "New chat") {
  return updateData((data) => {
    const now = nowIso();
    const session: ChatSession = {
      id: createId("sess"),
      projectId,
      title,
      summary: "",
      messageIds: [],
      artifactIds: [],
      fileIds: [],
      createdAt: now,
      updatedAt: now,
    };
    data.sessions.unshift(session);
    return session;
  });
}

export function addMessageToData(data: AppData, message: ChatMessage) {
  data.messages.push(message);
  const session = data.sessions.find((item) => item.id === message.sessionId);
  if (session) {
    session.messageIds.push(message.id);
    session.updatedAt = message.createdAt;
    if (message.fileIds.length) {
      session.fileIds = Array.from(new Set([...session.fileIds, ...message.fileIds]));
    }
    if (session.title === "New chat" && message.role === "user") {
      session.title = message.content.replace(/\s+/g, " ").slice(0, 52) || "New chat";
    }
  }
}

export function addArtifactToData(data: AppData, artifact: Artifact) {
  data.artifacts.unshift(artifact);
  const session = data.sessions.find((item) => item.id === artifact.sessionId);
  if (session) {
    session.artifactIds = Array.from(new Set([artifact.id, ...session.artifactIds]));
    session.updatedAt = artifact.updatedAt;
  }
}

export function addMemoryToData(data: AppData, memory: MemoryItem) {
  data.memories.unshift(memory);
}

export function addFileToData(data: AppData, file: StoredFile) {
  data.files.unshift(file);
  if (file.sessionId) {
    const session = data.sessions.find((item) => item.id === file.sessionId);
    if (session) {
      session.fileIds = Array.from(new Set([file.id, ...session.fileIds]));
      session.updatedAt = file.createdAt;
    }
  }
}

export function addToolInvocationToData(data: AppData, invocation: ToolInvocation) {
  data.toolInvocations.unshift(invocation);
  const message = invocation.messageId
    ? data.messages.find((item) => item.id === invocation.messageId)
    : null;
  if (message) {
    message.toolInvocationIds = Array.from(new Set([invocation.id, ...message.toolInvocationIds]));
  }
}

