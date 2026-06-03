"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  Archive,
  Bot,
  Check,
  ChevronDown,
  Circle,
  Download,
  FileText,
  FolderPlus,
  Loader2,
  MemoryStick,
  MessageSquarePlus,
  Paperclip,
  Play,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AppData,
  Artifact,
  ChatMessage,
  ChatSession,
  Project,
  RuntimeStatus,
  StoredFile,
  ToolInvocation,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type BootstrapData = AppData & { runtime: RuntimeStatus };

const MODEL_OPTIONS = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-6",
  "claude-haiku-4-5-20251001",
];

function emptyData(): BootstrapData {
  return {
    projects: [],
    sessions: [],
    messages: [],
    memories: [],
    files: [],
    skills: [],
    artifacts: [],
    toolInvocations: [],
    runtime: {
      claude: { configured: false, model: MODEL_OPTIONS[0] },
      atlassian: {
        enabled: false,
        endpoint: "",
        command: "",
        status: "disabled",
        message: "",
      },
      storage: { dataDir: "" },
    },
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function short(text: string, length = 72) {
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function useBootstrap() {
  const [data, setData] = useState<BootstrapData>(emptyData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Bootstrap failed: ${response.status}`);
      }
      setData((await response.json()) as BootstrapData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, setData, loading, error, refresh };
}

export function WorkspaceApp() {
  const { data, loading, error, refresh } = useBootstrap();
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingUser, setPendingUser] = useState<ChatMessage | null>(null);
  const [liveTools, setLiveTools] = useState<Array<Record<string, unknown>>>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [memoryContent, setMemoryContent] = useState("");
  const [artifactTitle, setArtifactTitle] = useState("Generated notes");
  const [artifactContent, setArtifactContent] = useState("# Notes\n\n");
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState({ name: "", description: "", instructions: "" });
  const [rovoResult, setRovoResult] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeProject = useMemo(
    () => data.projects.find((project) => project.id === activeProjectId) ?? data.projects[0],
    [activeProjectId, data.projects],
  );

  const projectSessions = useMemo(
    () =>
      activeProject
        ? data.sessions
            .filter((session) => session.projectId === activeProject.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : [],
    [activeProject, data.sessions],
  );

  const activeSession = useMemo(
    () =>
      projectSessions.find((session) => session.id === activeSessionId) ??
      projectSessions[0] ??
      data.sessions[0],
    [activeSessionId, data.sessions, projectSessions],
  );

  const persistedMessages = useMemo(() => {
    if (!activeSession) {
      return [];
    }
    const ids = new Set(activeSession.messageIds);
    return data.messages
      .filter((message) => ids.has(message.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [activeSession, data.messages]);

  const visibleMessages = useMemo(() => {
    const messages = [...persistedMessages];
    if (pendingUser) {
      messages.push(pendingUser);
    }
    if (streamingText) {
      messages.push({
        id: "streaming",
        sessionId: activeSession?.id ?? "",
        role: "assistant",
        content: streamingText,
        model,
        fileIds: [],
        toolInvocationIds: [],
        createdAt: new Date().toISOString(),
      });
    }
    return messages;
  }, [activeSession?.id, model, pendingUser, persistedMessages, streamingText]);

  const sessionArtifacts = useMemo(() => {
    if (!activeSession) {
      return [];
    }
    return data.artifacts.filter((artifact) => activeSession.artifactIds.includes(artifact.id));
  }, [activeSession, data.artifacts]);

  const selectedArtifact = useMemo(
    () => sessionArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? sessionArtifacts[0],
    [selectedArtifactId, sessionArtifacts],
  );

  const sessionFiles = useMemo(() => {
    if (!activeSession) {
      return [];
    }
    return data.files.filter((file) => activeSession.fileIds.includes(file.id));
  }, [activeSession, data.files]);

  const pendingApprovals = useMemo(
    () =>
      data.toolInvocations.filter(
        (tool) => tool.requiresApproval && tool.status === "pending_approval",
      ),
    [data.toolInvocations],
  );

  useEffect(() => {
    if (!activeProjectId && data.projects[0]) {
      setActiveProjectId(data.projects[0].id);
    }
    if (!activeSessionId && data.sessions[0]) {
      setActiveSessionId(data.sessions[0].id);
    }
    if (data.runtime.claude.model) {
      setModel((current) => current || data.runtime.claude.model);
    }
  }, [activeProjectId, activeSessionId, data.projects, data.runtime.claude.model, data.sessions]);

  useEffect(() => {
    if (activeProject) {
      setProjectDraft({
        name: activeProject.name,
        description: activeProject.description,
        instructions: activeProject.instructions,
      });
    }
  }, [activeProject]);

  useEffect(() => {
    if (selectedArtifact) {
      setArtifactTitle(selectedArtifact.title);
      setArtifactContent(selectedArtifact.content);
      setSelectedArtifactId(selectedArtifact.id);
    }
  }, [selectedArtifact]);

  async function createProject() {
    const name = window.prompt("Project name", "New Claude Project");
    if (!name) {
      return;
    }
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "Personal workspace project",
        instructions: "Use this project context carefully and keep outputs practical.",
      }),
    });
    const payload = (await response.json()) as { project: Project };
    await refresh();
    setActiveProjectId(payload.project.id);
    setActiveSessionId("");
  }

  async function saveProject() {
    if (!activeProject) {
      return;
    }
    await fetch(`/api/projects/${activeProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectDraft),
    });
    await refresh();
  }

  async function newSession() {
    if (!activeProject) {
      return;
    }
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: activeProject.id, title: "New chat" }),
    });
    const payload = (await response.json()) as { session: ChatSession };
    await refresh();
    setActiveSessionId(payload.session.id);
  }

  async function sendMessage() {
    if (!activeProject || !activeSession || !prompt.trim() || isSending) {
      return;
    }

    const content = prompt.trim();
    setPrompt("");
    setStreamingText("");
    setLiveTools([]);
    setIsSending(true);
    const controller = new AbortController();
    abortRef.current = controller;

    setPendingUser({
      id: "pending-user",
      sessionId: activeSession.id,
      role: "user",
      content,
      fileIds: selectedFileIds,
      toolInvocationIds: [],
      createdAt: new Date().toISOString(),
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          projectId: activeProject.id,
          sessionId: activeSession.id,
          message: content,
          fileIds: selectedFileIds,
          model,
          toolsEnabled,
        }),
      });

      if (!response.body) {
        throw new Error("Chat stream was empty.");
      }

      await readEventStream(response.body, (event, payload) => {
        if (event === "delta" && isRecord(payload)) {
          setStreamingText((current) => current + String(payload.text ?? ""));
        }
        if (event === "tool" && isRecord(payload)) {
          setLiveTools((current) => [payload, ...current].slice(0, 8));
        }
        if (event === "error" && isRecord(payload)) {
          setStreamingText((current) => `${current}\n\nError: ${String(payload.message ?? "unknown")}`);
        }
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setStreamingText(`Request failed: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
      setPendingUser(null);
      setSelectedFileIds([]);
      setStreamingText("");
      await refresh();
    }
  }

  function stopMessage() {
    abortRef.current?.abort();
    setIsSending(false);
  }

  async function uploadFile(file: File | null) {
    if (!file || !activeProject || !activeSession) {
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", activeProject.id);
    form.append("sessionId", activeSession.id);
    const response = await fetch("/api/files", { method: "POST", body: form });
    const payload = (await response.json()) as { file: StoredFile };
    setSelectedFileIds((current) => Array.from(new Set([payload.file.id, ...current])));
    await refresh();
  }

  async function createMemory(scope: "global" | "project") {
    if (!memoryContent.trim() || !activeProject) {
      return;
    }
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        scope,
        projectId: activeProject.id,
        type: "fact",
        content: memoryContent.trim(),
      }),
    });
    setMemoryContent("");
    await refresh();
  }

  async function updateMemory(id: string, action: "approve" | "disable" | "delete") {
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await refresh();
  }

  async function saveArtifact() {
    if (!activeProject || !activeSession) {
      return;
    }
    const response = await fetch("/api/artifacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedArtifactId ?? undefined,
        projectId: activeProject.id,
        sessionId: activeSession.id,
        title: artifactTitle,
        content: artifactContent,
      }),
    });
    const payload = (await response.json()) as { artifact: Artifact };
    setSelectedArtifactId(payload.artifact.id);
    await refresh();
  }

  async function checkRovo() {
    setRovoResult("Checking Rovo MCP...");
    const response = await fetch("/api/tools/rovo", { cache: "no-store" });
    const payload = await response.json();
    setRovoResult(JSON.stringify(payload, null, 2));
  }

  async function approveTool(invocationId: string, decision: "approve" | "reject") {
    await fetch("/api/tools/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invocationId, decision }),
    });
    await refresh();
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading local workspace
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md border border-destructive/30 bg-card p-5">
          <h1 className="text-lg font-semibold">Workspace failed to load</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="hidden w-[280px] shrink-0 border-r border-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Claude Workspace</div>
              <div className="text-xs text-muted-foreground">Local API app</div>
            </div>
          </div>
          <ConnectionDot configured={data.runtime.claude.configured} />
        </div>

        <div className="flex gap-2 p-3">
          <Button className="flex-1" size="sm" onClick={() => void newSession()}>
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </Button>
          <Button size="icon" variant="outline" onClick={() => void createProject()}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <SidebarSection title="Projects">
            {data.projects
              .filter((project) => !project.archived)
              .map((project) => (
                <button
                  key={project.id}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                    activeProject?.id === project.id && "bg-sidebar-accent font-medium",
                  )}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    const first = data.sessions.find((session) => session.projectId === project.id);
                    setActiveSessionId(first?.id ?? "");
                  }}
                >
                  <div className="truncate">{project.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{project.description}</div>
                </button>
              ))}
          </SidebarSection>

          <SidebarSection title="Sessions">
            {projectSessions.map((session) => (
              <button
                key={session.id}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                  activeSession?.id === session.id && "bg-sidebar-accent font-medium",
                )}
                onClick={() => setActiveSessionId(session.id)}
              >
                <div className="truncate">{session.title}</div>
                <div className="text-xs text-muted-foreground">{formatTime(session.updatedAt)}</div>
              </button>
            ))}
          </SidebarSection>
        </ScrollArea>

        <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Claude API</span>
            <span>{data.runtime.claude.configured ? "configured" : "missing key"}</span>
          </div>
          <div className="mt-1 truncate font-mono">{data.runtime.claude.model}</div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2">
          <div className="min-w-0 max-w-[128px] sm:max-w-none">
            <h1 className="truncate text-sm font-semibold">{activeSession?.title ?? "New chat"}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {activeProject?.name ?? "No project"} / {sessionFiles.length} files /{" "}
              {pendingApprovals.length} approvals
            </p>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2 text-xs font-medium">
              <span className="sr-only">Model</span>
              <select
                className="w-[124px] bg-transparent outline-none sm:w-[220px]"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {short(option, 28)}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </label>
            <Button
              size="sm"
              variant={toolsEnabled ? "default" : "outline"}
              onClick={() => setToolsEnabled((value) => !value)}
            >
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Tools</span>
            </Button>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-6 sm:px-4">
            {!data.runtime.claude.configured && (
              <Notice
                title="Claude API key is missing"
                body="Create .env.local from .env.local.example, set ANTHROPIC_API_KEY, then restart npm run dev."
              />
            )}

            {visibleMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                files={data.files.filter((file) => message.fileIds.includes(file.id))}
              />
            ))}

            {liveTools.length > 0 && (
              <div className="ml-10 space-y-2 border-l border-border pl-3">
                {liveTools.map((tool, index) => (
                  <ToolLine key={`${String(tool.name)}-${index}`} tool={tool} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-card p-3">
          <div className="mx-auto max-w-4xl">
            {selectedFileIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedFileIds.map((id) => {
                  const file = data.files.find((item) => item.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {file?.name ?? id}
                      <button
                        onClick={() => setSelectedFileIds((current) => current.filter((item) => item !== id))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)}
              />
              <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask Claude, generate a .md file, search sessions, or prepare Jira/Confluence work..."
                className="max-h-40 min-h-16 resize-none bg-background"
              />
              {isSending ? (
                <Button size="icon" variant="destructive" onClick={stopMessage}>
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" onClick={() => void sendMessage()} disabled={!prompt.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <aside className="hidden w-[360px] shrink-0 border-l border-border bg-card xl:block">
        <Tabs defaultValue="project" className="flex h-screen flex-col">
          <TabsList className="m-3 grid grid-cols-6">
            <TabsTrigger value="project">
              <Settings2 className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="memory">
              <MemoryStick className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="files">
              <Upload className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="skills">
              <ShieldCheck className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Wrench className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="artifacts">
              <FileText className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
            <TabsContent value="project" className="space-y-3">
              <PanelHeader title="Project" count={data.projects.length} />
              <Input
                value={projectDraft.name}
                onChange={(event) => setProjectDraft((draft) => ({ ...draft, name: event.target.value }))}
              />
              <Textarea
                value={projectDraft.description}
                onChange={(event) =>
                  setProjectDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                className="min-h-20"
                placeholder="Project description"
              />
              <Textarea
                value={projectDraft.instructions}
                onChange={(event) =>
                  setProjectDraft((draft) => ({ ...draft, instructions: event.target.value }))
                }
                className="min-h-36"
                placeholder="Project instructions"
              />
              <Button className="w-full" onClick={() => void saveProject()}>
                <Save className="h-4 w-4" />
                Save project
              </Button>
            </TabsContent>

            <TabsContent value="memory" className="space-y-3">
              <PanelHeader title="Memory" count={data.memories.length} />
              <Textarea
                value={memoryContent}
                onChange={(event) => setMemoryContent(event.target.value)}
                placeholder="Add durable memory for this project or globally..."
                className="min-h-24"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => void createMemory("project")}>
                  Project
                </Button>
                <Button variant="outline" onClick={() => void createMemory("global")}>
                  Global
                </Button>
              </div>
              <Separator />
              {data.memories.map((memory) => (
                <div key={memory.id} className="space-y-2 border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={memory.status === "active" ? "default" : "secondary"}>
                      {memory.scope} / {memory.status}
                    </Badge>
                    <div className="flex gap-1">
                      {memory.status === "pending" && (
                        <Button size="icon" variant="ghost" onClick={() => void updateMemory(memory.id, "approve")}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => void updateMemory(memory.id, "disable")}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => void updateMemory(memory.id, "delete")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm leading-6">{memory.content}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="files" className="space-y-3">
              <PanelHeader title="Files" count={sessionFiles.length} />
              <Button className="w-full" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Upload file
              </Button>
              {sessionFiles.map((file) => (
                <button
                  key={file.id}
                  className={cn(
                    "w-full border border-border bg-background p-3 text-left text-sm",
                    selectedFileIds.includes(file.id) && "border-primary",
                  )}
                  onClick={() =>
                    setSelectedFileIds((current) =>
                      current.includes(file.id)
                        ? current.filter((item) => item !== file.id)
                        : [file.id, ...current],
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{file.name}</span>
                    <Badge variant="secondary">{Math.ceil(file.size / 1024)} KB</Badge>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{file.textPreview}</p>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="skills" className="space-y-3">
              <PanelHeader title="Skills" count={data.skills.length} />
              {data.skills.map((skill) => (
                <div key={skill.id} className="border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{skill.name}</div>
                      <div className="text-xs text-muted-foreground">v{skill.version} / {skill.source}</div>
                    </div>
                    <Badge>{skill.enabled ? "enabled" : "off"}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{skill.description}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="tools" className="space-y-3">
              <PanelHeader title="Tools" count={data.toolInvocations.length} />
              <Notice
                title="Atlassian Rovo MCP"
                body={data.runtime.atlassian.message || "Not configured"}
              />
              <Button className="w-full" variant="outline" onClick={() => void checkRovo()}>
                <Search className="h-4 w-4" />
                Check Rovo tools
              </Button>
              {rovoResult && (
                <pre className="max-h-64 overflow-auto border border-border bg-background p-3 text-xs">
                  {rovoResult}
                </pre>
              )}
              <Separator />
              {pendingApprovals.map((tool) => (
                <ApprovalTool
                  key={tool.id}
                  tool={tool}
                  onDecision={(decision) => void approveTool(tool.id, decision)}
                />
              ))}
              {data.toolInvocations.slice(0, 12).map((tool) => (
                <ToolInvocationLine key={tool.id} tool={tool} />
              ))}
            </TabsContent>

            <TabsContent value="artifacts" className="space-y-3">
              <PanelHeader title="Artifacts" count={sessionArtifacts.length} />
              <Input value={artifactTitle} onChange={(event) => setArtifactTitle(event.target.value)} />
              <Textarea
                value={artifactContent}
                onChange={(event) => setArtifactContent(event.target.value)}
                className="min-h-48 font-mono text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => void saveArtifact()}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <a
                  className={cn(
                    "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted",
                    !selectedArtifactId && "pointer-events-none opacity-50",
                  )}
                  href={selectedArtifactId ? `/api/artifacts/${selectedArtifactId}/download` : "#"}
                >
                  <Download className="h-4 w-4" />
                  .md
                </a>
              </div>
              <div className="border border-border bg-background p-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifactContent}</ReactMarkdown>
              </div>
              <Separator />
              {sessionArtifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  className={cn(
                    "w-full border border-border bg-background p-3 text-left",
                    selectedArtifactId === artifact.id && "border-primary",
                  )}
                  onClick={() => setSelectedArtifactId(artifact.id)}
                >
                  <div className="truncate text-sm font-medium">{artifact.title}</div>
                  <div className="text-xs text-muted-foreground">
                    v{artifact.version} / {formatTime(artifact.updatedAt)}
                  </div>
                </button>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </aside>
    </main>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 px-3 py-2">
      <div className="px-2 py-1 text-xs font-medium uppercase text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function PanelHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

function ConnectionDot({ configured }: { configured: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Circle
          className={cn("h-3 w-3 fill-current", configured ? "text-primary" : "text-destructive")}
        />
      </TooltipTrigger>
      <TooltipContent>{configured ? "Claude API configured" : "Missing ANTHROPIC_API_KEY"}</TooltipContent>
    </Tooltip>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="break-words border border-border bg-secondary p-3 text-sm [overflow-wrap:anywhere]">
      <div className="font-medium">{title}</div>
      <div className="mt-1 leading-5 text-muted-foreground">{body}</div>
    </div>
  );
}

function MessageBubble({ message, files }: { message: ChatMessage; files: StoredFile[] }) {
  const isUser = message.role === "user";

  return (
    <article className={cn("flex min-w-0 gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "min-w-0 max-w-[72vw] break-words border border-border px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] sm:max-w-[86%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-card",
        )}
      >
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {files.map((file) => (
              <Badge key={file.id} variant="secondary">
                {file.name}
              </Badge>
            ))}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:overflow-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        <div className={cn("mt-2 text-xs", isUser ? "text-primary-foreground/75" : "text-muted-foreground")}>
          {message.model ? `${message.model} / ` : ""}
          {message.id === "streaming" ? "streaming" : formatTime(message.createdAt)}
        </div>
      </div>
      {isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary">
          <Play className="h-4 w-4" />
        </div>
      )}
    </article>
  );
}

function ToolLine({ tool }: { tool: Record<string, unknown> }) {
  return (
    <div className="border border-border bg-card p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{String(tool.name ?? "tool")}</span>
        <Badge variant="secondary">{String(tool.status ?? "running")}</Badge>
      </div>
      <pre className="mt-2 max-h-24 overflow-auto text-muted-foreground">
        {JSON.stringify(tool.output ?? tool.input ?? {}, null, 2)}
      </pre>
    </div>
  );
}

function ApprovalTool({
  tool,
  onDecision,
}: {
  tool: ToolInvocation;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  return (
    <div className="space-y-2 border border-primary/40 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{tool.toolName}</div>
        <Badge>approval</Badge>
      </div>
      <pre className="max-h-32 overflow-auto text-xs text-muted-foreground">
        {JSON.stringify(tool.input, null, 2)}
      </pre>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => onDecision("approve")}>
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecision("reject")}>
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

function ToolInvocationLine({ tool }: { tool: ToolInvocation }) {
  return (
    <div className="border border-border bg-background p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{tool.toolName}</span>
        <Badge variant={tool.status === "success" ? "default" : "secondary"}>{tool.status}</Badge>
      </div>
      <div className="mt-1 text-muted-foreground">{tool.provider}</div>
    </div>
  );
}

async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, payload: unknown) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let splitAt = buffer.indexOf("\n\n");
    while (splitAt !== -1) {
      const packet = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      const event = packet.match(/^event: (.+)$/m)?.[1] ?? "message";
      const rawData = packet.match(/^data: (.+)$/m)?.[1] ?? "{}";
      try {
        onEvent(event, JSON.parse(rawData));
      } catch {
        onEvent(event, rawData);
      }
      splitAt = buffer.indexOf("\n\n");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
