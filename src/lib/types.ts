export type ID = string;

export type MessageRole = "user" | "assistant";

export type MemoryScope = "global" | "project";

export type MemoryStatus = "active" | "pending" | "disabled";

export type ToolInvocationStatus =
  | "pending_approval"
  | "running"
  | "success"
  | "error"
  | "rejected";

export type ToolProvider = "local" | "atlassian";

export interface Project {
  id: ID;
  name: string;
  description: string;
  instructions: string;
  archived: boolean;
  activeSkillIds: ID[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: ID;
  projectId: ID;
  title: string;
  summary: string;
  messageIds: ID[];
  artifactIds: ID[];
  fileIds: ID[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: ID;
  sessionId: ID;
  role: MessageRole;
  content: string;
  model?: string;
  fileIds: ID[];
  toolInvocationIds: ID[];
  createdAt: string;
}

export interface MemoryItem {
  id: ID;
  projectId: ID | null;
  scope: MemoryScope;
  type: "preference" | "fact" | "decision" | "terminology" | "workflow" | "constraint";
  content: string;
  status: MemoryStatus;
  sourceSessionId: ID | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFile {
  id: ID;
  projectId: ID | null;
  sessionId: ID | null;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  textPreview: string;
  providerFileId: string | null;
  status: "ready" | "error";
  createdAt: string;
}

export interface Skill {
  id: ID;
  name: string;
  description: string;
  version: string;
  source: "local" | "anthropic";
  instructions: string;
  enabled: boolean;
  apiSkill: {
    skillId: string;
    type: string;
    version: string;
  } | null;
  createdAt: string;
}

export interface Artifact {
  id: ID;
  projectId: ID;
  sessionId: ID;
  createdByMessageId: ID | null;
  title: string;
  type: "markdown";
  content: string;
  version: number;
  status: "draft" | "saved";
  createdAt: string;
  updatedAt: string;
}

export interface ToolInvocation {
  id: ID;
  sessionId: ID;
  messageId: ID | null;
  provider: ToolProvider;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ToolInvocationStatus;
  requiresApproval: boolean;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  projects: Project[];
  sessions: ChatSession[];
  messages: ChatMessage[];
  memories: MemoryItem[];
  files: StoredFile[];
  skills: Skill[];
  artifacts: Artifact[];
  toolInvocations: ToolInvocation[];
}

export interface RuntimeStatus {
  claude: {
    configured: boolean;
    model: string;
  };
  atlassian: {
    enabled: boolean;
    endpoint: string;
    command: string;
    status: "disabled" | "configured" | "error";
    message: string;
  };
  storage: {
    dataDir: string;
  };
}

