module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/src/lib/context.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildAnthropicMessages",
    ()=>buildAnthropicMessages,
    "buildSystemPrompt",
    ()=>buildSystemPrompt,
    "sessionMessages",
    ()=>sessionMessages
]);
const MAX_HISTORY_MESSAGES = 24;
const MAX_FILE_PREVIEW_CHARS = 2800;
function sessionMessages(data, session) {
    const ids = new Set(session.messageIds);
    return data.messages.filter((message)=>ids.has(message.id)).sort((a, b)=>a.createdAt.localeCompare(b.createdAt));
}
function buildSystemPrompt(data, project, session) {
    const memories = data.memories.filter((memory)=>memory.status === "active" && (memory.scope === "global" || memory.projectId === project.id));
    const skills = data.skills.filter((skill)=>skill.enabled && project.activeSkillIds.includes(skill.id));
    const files = data.files.filter((file)=>session.fileIds.includes(file.id));
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
        memories.length ? `Active memory:\n${memories.map((memory)=>`- [${memory.scope}/${memory.type}] ${memory.content}`).join("\n")}` : "Active memory: none.",
        skills.length ? `Enabled skills:\n${skills.map((skill)=>`- ${skill.name} v${skill.version}: ${skill.instructions}`).join("\n")}` : "Enabled skills: none.",
        files.length ? `Attached file previews:\n${files.map((file)=>`--- ${file.name} (${file.id}) ---\n${file.textPreview.slice(0, MAX_FILE_PREVIEW_CHARS)}`).join("\n\n")}` : "Attached file previews: none."
    ].filter(Boolean).join("\n");
}
function buildAnthropicMessages(messages) {
    return messages.slice(-MAX_HISTORY_MESSAGES).map((message)=>({
            role: message.role,
            content: message.content
        }));
}
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[project]/src/lib/env.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_MODEL",
    ()=>DEFAULT_MODEL,
    "ROVO_MCP_ENDPOINT",
    ()=>ROVO_MCP_ENDPOINT,
    "getClaudeModel",
    ()=>getClaudeModel,
    "getDataDir",
    ()=>getDataDir,
    "getRuntimeStatus",
    ()=>getRuntimeStatus
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
;
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const ROVO_MCP_ENDPOINT = "https://mcp.atlassian.com/v1/mcp/authv2";
function getClaudeModel() {
    return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}
function getDataDir() {
    return process.env.APP_DATA_DIR ? __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].resolve(process.env.APP_DATA_DIR) : __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), "data");
}
function getRuntimeStatus() {
    const atlassianEnabled = process.env.ATLASSIAN_MCP_ENABLED === "true";
    return {
        claude: {
            configured: Boolean(process.env.ANTHROPIC_API_KEY),
            model: getClaudeModel()
        },
        atlassian: {
            enabled: atlassianEnabled,
            endpoint: ROVO_MCP_ENDPOINT,
            command: `npx -y mcp-remote@latest ${ROVO_MCP_ENDPOINT}`,
            status: atlassianEnabled ? "configured" : "disabled",
            message: atlassianEnabled ? "Atlassian MCP is enabled. OAuth may still need to be completed by mcp-remote." : "Set ATLASSIAN_MCP_ENABLED=true after completing mcp-remote OAuth setup."
        },
        storage: {
            dataDir: getDataDir()
        }
    };
}
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[project]/src/lib/ids.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createId",
    ()=>createId,
    "nowIso",
    ()=>nowIso
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$nanoid$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/nanoid/index.js [app-route] (ecmascript) <locals>");
;
function createId(prefix) {
    return `${prefix}_${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$nanoid$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["nanoid"])(12)}`;
}
function nowIso() {
    return new Date().toISOString();
}
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[project]/src/lib/store.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addArtifactToData",
    ()=>addArtifactToData,
    "addFileToData",
    ()=>addFileToData,
    "addMemoryToData",
    ()=>addMemoryToData,
    "addMessageToData",
    ()=>addMessageToData,
    "addToolInvocationToData",
    ()=>addToolInvocationToData,
    "createProject",
    ()=>createProject,
    "createSession",
    ()=>createSession,
    "findProject",
    ()=>findProject,
    "findSession",
    ()=>findSession,
    "getUploadsDir",
    ()=>getUploadsDir,
    "readData",
    ()=>readData,
    "updateData",
    ()=>updateData,
    "writeData",
    ()=>writeData
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/env.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ids.ts [app-route] (ecmascript)");
;
;
;
;
const STORE_FILE = "store.json";
function storePath() {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDataDir"])(), STORE_FILE);
}
function uploadsDir() {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDataDir"])(), "uploads");
}
function getUploadsDir() {
    return uploadsDir();
}
function seedData() {
    const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    const projectId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("proj");
    const sessionId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("sess");
    const messageId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("msg");
    const project = {
        id: projectId,
        name: "Personal Claude Workspace",
        description: "Workspace utama untuk chat Claude API, memory, file, skills, dan Atlassian tools.",
        instructions: "Bantu user bekerja secara praktis. Gunakan memory dan file project hanya saat relevan. Untuk aksi Jira/Confluence yang menulis data, minta approval terlebih dahulu.",
        archived: false,
        activeSkillIds: [
            "skill_prd_writer",
            "skill_atlassian_operator"
        ],
        createdAt: now,
        updatedAt: now
    };
    const session = {
        id: sessionId,
        projectId,
        title: "Welcome session",
        summary: "Initial seeded session.",
        messageIds: [
            messageId
        ],
        artifactIds: [],
        fileIds: [],
        createdAt: now,
        updatedAt: now
    };
    const message = {
        id: messageId,
        sessionId,
        role: "assistant",
        content: "Claude-like local workspace is ready. Add ANTHROPIC_API_KEY in .env.local, then start a chat, upload files, create memory, or generate a Markdown artifact.",
        fileIds: [],
        toolInvocationIds: [],
        createdAt: now
    };
    const skills = [
        {
            id: "skill_prd_writer",
            name: "PRD Writer",
            description: "Structure requirements, acceptance criteria, risks, and milestones into Markdown.",
            version: "1.0.0",
            source: "local",
            instructions: "When the user asks for product requirements, produce concise PRDs with scope, requirements, risks, and acceptance criteria. Prefer Markdown artifacts for durable output.",
            enabled: true,
            apiSkill: null,
            createdAt: now
        },
        {
            id: "skill_atlassian_operator",
            name: "Atlassian Operator",
            description: "Use Jira and Confluence carefully through approval-gated tool calls.",
            version: "1.0.0",
            source: "local",
            instructions: "Use Atlassian tools for searching and reading. For creating or updating Jira/Confluence, explain the proposed write and wait for approval.",
            enabled: true,
            apiSkill: null,
            createdAt: now
        }
    ];
    return {
        projects: [
            project
        ],
        sessions: [
            session
        ],
        messages: [
            message
        ],
        memories: [],
        files: [],
        skills,
        artifacts: [],
        toolInvocations: []
    };
}
async function ensureDataFiles() {
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDataDir"])(), {
        recursive: true
    });
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir(uploadsDir(), {
        recursive: true
    });
    try {
        await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].access(storePath());
    } catch  {
        await writeData(seedData());
    }
}
async function readData() {
    await ensureDataFiles();
    const raw = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
        projects: parsed.projects ?? [],
        sessions: parsed.sessions ?? [],
        messages: parsed.messages ?? [],
        memories: parsed.memories ?? [],
        files: parsed.files ?? [],
        skills: parsed.skills ?? [],
        artifacts: parsed.artifacts ?? [],
        toolInvocations: parsed.toolInvocations ?? []
    };
}
async function writeData(data) {
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDataDir"])(), {
        recursive: true
    });
    const target = storePath();
    const tmp = `${target}.tmp`;
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].rename(tmp, target);
}
async function updateData(mutator) {
    const data = await readData();
    const result = await mutator(data);
    await writeData(data);
    return result;
}
function findProject(data, projectId) {
    return data.projects.find((project)=>project.id === projectId && !project.archived) ?? data.projects[0];
}
function findSession(data, sessionId) {
    return data.sessions.find((session)=>session.id === sessionId) ?? data.sessions[0];
}
async function createProject(input) {
    return updateData((data)=>{
        const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
        const project = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("proj"),
            name: input.name,
            description: input.description,
            instructions: input.instructions,
            archived: false,
            activeSkillIds: data.skills.filter((skill)=>skill.enabled).map((skill)=>skill.id),
            createdAt: now,
            updatedAt: now
        };
        data.projects.unshift(project);
        return project;
    });
}
async function createSession(projectId, title = "New chat") {
    return updateData((data)=>{
        const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
        const session = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("sess"),
            projectId,
            title,
            summary: "",
            messageIds: [],
            artifactIds: [],
            fileIds: [],
            createdAt: now,
            updatedAt: now
        };
        data.sessions.unshift(session);
        return session;
    });
}
function addMessageToData(data, message) {
    data.messages.push(message);
    const session = data.sessions.find((item)=>item.id === message.sessionId);
    if (session) {
        session.messageIds.push(message.id);
        session.updatedAt = message.createdAt;
        if (message.fileIds.length) {
            session.fileIds = Array.from(new Set([
                ...session.fileIds,
                ...message.fileIds
            ]));
        }
        if (session.title === "New chat" && message.role === "user") {
            session.title = message.content.replace(/\s+/g, " ").slice(0, 52) || "New chat";
        }
    }
}
function addArtifactToData(data, artifact) {
    data.artifacts.unshift(artifact);
    const session = data.sessions.find((item)=>item.id === artifact.sessionId);
    if (session) {
        session.artifactIds = Array.from(new Set([
            artifact.id,
            ...session.artifactIds
        ]));
        session.updatedAt = artifact.updatedAt;
    }
}
function addMemoryToData(data, memory) {
    data.memories.unshift(memory);
}
function addFileToData(data, file) {
    data.files.unshift(file);
    if (file.sessionId) {
        const session = data.sessions.find((item)=>item.id === file.sessionId);
        if (session) {
            session.fileIds = Array.from(new Set([
                file.id,
                ...session.fileIds
            ]));
            session.updatedAt = file.createdAt;
        }
    }
}
function addToolInvocationToData(data, invocation) {
    data.toolInvocations.unshift(invocation);
    const message = invocation.messageId ? data.messages.find((item)=>item.id === invocation.messageId) : null;
    if (message) {
        message.toolInvocationIds = Array.from(new Set([
            invocation.id,
            ...message.toolInvocationIds
        ]));
    }
}
}),
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/node:process [external] (node:process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:process", () => require("node:process"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/lib/rovo-mcp.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "callRovoTool",
    ()=>callRovoTool,
    "listRovoTools",
    ()=>listRovoTools
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$modelcontextprotocol$2f$sdk$2f$dist$2f$esm$2f$client$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$modelcontextprotocol$2f$sdk$2f$dist$2f$esm$2f$client$2f$stdio$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/env.ts [app-route] (ecmascript)");
;
;
;
function disabledResult() {
    return {
        ok: false,
        error: "Atlassian MCP is not enabled.",
        setup: "Run mcp-remote OAuth locally, then set ATLASSIAN_MCP_ENABLED=true. Command: npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2"
    };
}
async function withTimeout(promise, timeoutMs, label) {
    let timeout;
    const timeoutPromise = new Promise((_, reject)=>{
        timeout = setTimeout(()=>reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
        return await Promise.race([
            promise,
            timeoutPromise
        ]);
    } finally{
        clearTimeout(timeout);
    }
}
async function createRovoClient() {
    const client = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$modelcontextprotocol$2f$sdk$2f$dist$2f$esm$2f$client$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Client"]({
        name: "claude-like-local-workspace",
        version: "0.1.0"
    }, {
        capabilities: {}
    });
    const transport = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$modelcontextprotocol$2f$sdk$2f$dist$2f$esm$2f$client$2f$stdio$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["StdioClientTransport"]({
        command: "npx",
        args: [
            "-y",
            "mcp-remote@latest",
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ROVO_MCP_ENDPOINT"]
        ]
    });
    await client.connect(transport);
    return {
        client,
        transport
    };
}
async function listRovoTools() {
    if (process.env.ATLASSIAN_MCP_ENABLED !== "true") {
        return disabledResult();
    }
    let handle = null;
    try {
        handle = await withTimeout(createRovoClient(), 15000, "Rovo MCP connect");
        const tools = await withTimeout(handle.client.listTools(), 10000, "Rovo MCP listTools");
        return {
            ok: true,
            data: tools
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown MCP error.",
            setup: "If this is the first run, execute the mcp-remote command in a terminal and complete Atlassian OAuth."
        };
    } finally{
        await handle?.client.close().catch(()=>undefined);
    }
}
async function callRovoTool(name, args) {
    if (process.env.ATLASSIAN_MCP_ENABLED !== "true") {
        return disabledResult();
    }
    let handle = null;
    try {
        handle = await withTimeout(createRovoClient(), 15000, "Rovo MCP connect");
        const result = await withTimeout(handle.client.callTool({
            name,
            arguments: args
        }), 20000, `Rovo MCP call ${name}`);
        return {
            ok: true,
            data: result
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Unknown MCP error.",
            setup: "Rovo MCP call failed. Verify mcp-remote OAuth, Atlassian permissions, and ATLASSIAN_MCP_ENABLED=true."
        };
    } finally{
        await handle?.client.close().catch(()=>undefined);
    }
}
}),
"[project]/src/lib/tools.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LOCAL_TOOLS",
    ()=>LOCAL_TOOLS,
    "runTool",
    ()=>runTool
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rovo$2d$mcp$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rovo-mcp.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/store.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ids.ts [app-route] (ecmascript)");
;
;
;
const LOCAL_TOOLS = [
    {
        name: "create_markdown_artifact",
        description: "Create or save a Markdown artifact for durable output. Use this for PRDs, notes, specs, summaries, and generated .md files.",
        input_schema: {
            type: "object",
            required: [
                "title",
                "content"
            ],
            properties: {
                title: {
                    type: "string"
                },
                content: {
                    type: "string"
                }
            }
        }
    },
    {
        name: "propose_memory",
        description: "Propose a durable memory. The user must approve it before it becomes active.",
        input_schema: {
            type: "object",
            required: [
                "scope",
                "type",
                "content"
            ],
            properties: {
                scope: {
                    type: "string",
                    enum: [
                        "global",
                        "project"
                    ]
                },
                type: {
                    type: "string",
                    enum: [
                        "preference",
                        "fact",
                        "decision",
                        "terminology",
                        "workflow",
                        "constraint"
                    ]
                },
                content: {
                    type: "string"
                }
            }
        }
    },
    {
        name: "search_local_sessions",
        description: "Search saved local sessions by title, summary, and message content.",
        input_schema: {
            type: "object",
            required: [
                "query"
            ],
            properties: {
                query: {
                    type: "string"
                }
            }
        }
    },
    {
        name: "read_uploaded_file",
        description: "Read the stored text preview of an uploaded file by file_id.",
        input_schema: {
            type: "object",
            required: [
                "file_id"
            ],
            properties: {
                file_id: {
                    type: "string"
                }
            }
        }
    },
    {
        name: "atlassian_search",
        description: "Search Jira or Confluence through Atlassian Rovo MCP. Read-only. Requires mcp-remote OAuth setup.",
        input_schema: {
            type: "object",
            required: [
                "query",
                "target"
            ],
            properties: {
                target: {
                    type: "string",
                    enum: [
                        "jira",
                        "confluence",
                        "all"
                    ]
                },
                query: {
                    type: "string"
                }
            }
        }
    },
    {
        name: "atlassian_write_request",
        description: "Prepare a Jira or Confluence write. This never executes immediately; it creates a pending approval card.",
        input_schema: {
            type: "object",
            required: [
                "target",
                "action",
                "payload"
            ],
            properties: {
                target: {
                    type: "string",
                    enum: [
                        "jira",
                        "confluence"
                    ]
                },
                action: {
                    type: "string"
                },
                payload: {
                    type: "object"
                }
            }
        }
    }
];
function asRecord(input) {
    return input && typeof input === "object" ? input : {};
}
async function runTool(name, input, context) {
    const args = asRecord(input);
    const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    if (name === "create_markdown_artifact") {
        const title = String(args.title ?? "Generated Markdown");
        const content = String(args.content ?? "");
        const artifact = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateData"])((data)=>{
            const item = {
                id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("art"),
                projectId: context.projectId,
                sessionId: context.sessionId,
                createdByMessageId: context.messageId,
                title,
                type: "markdown",
                content,
                version: 1,
                status: "saved",
                createdAt: now,
                updatedAt: now
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addArtifactToData"])(data, item);
            return item;
        });
        const result = {
            artifact,
            message: `Markdown artifact saved as ${artifact.title}.`
        };
        const invocation = await recordTool(context, {
            provider: "local",
            toolName: name,
            input,
            output: result,
            status: "success",
            requiresApproval: false
        });
        return {
            ...result,
            invocationId: invocation.id
        };
    }
    if (name === "propose_memory") {
        const memory = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateData"])((data)=>{
            const scope = args.scope === "global" ? "global" : "project";
            const item = {
                id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("mem"),
                projectId: scope === "project" ? context.projectId : null,
                scope,
                type: args.type === "fact" || args.type === "decision" || args.type === "terminology" || args.type === "workflow" || args.type === "constraint" ? args.type : "preference",
                content: String(args.content ?? ""),
                status: "pending",
                sourceSessionId: context.sessionId,
                createdAt: now,
                updatedAt: now
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addMemoryToData"])(data, item);
            return item;
        });
        const result = {
            memory,
            message: "Memory proposed and waiting for user approval."
        };
        const invocation = await recordTool(context, {
            provider: "local",
            toolName: name,
            input,
            output: result,
            status: "success",
            requiresApproval: false
        });
        return {
            ...result,
            invocationId: invocation.id
        };
    }
    if (name === "search_local_sessions") {
        const query = String(args.query ?? "").toLowerCase();
        const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readData"])();
        const results = data.sessions.map((session)=>{
            const text = [
                session.title,
                session.summary,
                ...data.messages.filter((message)=>session.messageIds.includes(message.id)).map((message)=>message.content)
            ].join("\n").toLowerCase();
            return {
                session,
                matched: query ? text.includes(query) : false
            };
        }).filter((item)=>item.matched).slice(0, 8).map(({ session })=>({
                id: session.id,
                title: session.title,
                updatedAt: session.updatedAt
            }));
        const result = {
            results
        };
        const invocation = await recordTool(context, {
            provider: "local",
            toolName: name,
            input,
            output: result,
            status: "success",
            requiresApproval: false
        });
        return {
            ...result,
            invocationId: invocation.id
        };
    }
    if (name === "read_uploaded_file") {
        const fileId = String(args.file_id ?? "");
        const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readData"])();
        const file = data.files.find((item)=>item.id === fileId);
        const result = file ? {
            file: {
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                preview: file.textPreview
            }
        } : {
            error: `File ${fileId} was not found.`
        };
        const invocation = await recordTool(context, {
            provider: "local",
            toolName: name,
            input,
            output: result,
            status: file ? "success" : "error",
            requiresApproval: false
        });
        return {
            ...result,
            invocationId: invocation.id
        };
    }
    if (name === "atlassian_search") {
        const target = String(args.target ?? "all");
        const query = String(args.query ?? "");
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rovo$2d$mcp$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["callRovoTool"])("search", {
            query,
            target
        });
        const invocation = await recordTool(context, {
            provider: "atlassian",
            toolName: name,
            input,
            output: result,
            status: result.ok ? "success" : "error",
            requiresApproval: false
        });
        return {
            ...result,
            invocationId: invocation.id
        };
    }
    if (name === "atlassian_write_request") {
        const invocation = await recordTool(context, {
            provider: "atlassian",
            toolName: name,
            input,
            output: {
                message: "Write action is pending user approval. Nothing has been changed in Jira or Confluence yet."
            },
            status: "pending_approval",
            requiresApproval: true
        });
        return {
            approvalRequired: true,
            invocationId: invocation.id,
            message: "Created a pending approval card for this Atlassian write request."
        };
    }
    return {
        error: `Unknown tool: ${name}`
    };
}
async function recordTool(context, params) {
    const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateData"])((data)=>{
        const invocation = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("tool"),
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
            updatedAt: now
        };
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addToolInvocationToData"])(data, invocation);
        return invocation;
    });
}
}),
"[project]/src/lib/claude.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "appendUserMessage",
    ()=>appendUserMessage,
    "runAssistantTurn",
    ()=>runAssistantTurn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@anthropic-ai/sdk/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__Anthropic__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/@anthropic-ai/sdk/client.mjs [app-route] (ecmascript) <export Anthropic as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$context$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/context.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/env.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ids.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/store.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/tools.ts [app-route] (ecmascript)");
;
;
;
;
;
;
function getClient() {
    if (!process.env.ANTHROPIC_API_KEY) {
        return null;
    }
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__Anthropic__as__default$3e$__["default"]({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
}
function configuredApiSkills(data, project) {
    const storeSkills = data.skills.filter((skill)=>skill.enabled && project.activeSkillIds.includes(skill.id) && skill.apiSkill).map((skill)=>skill.apiSkill);
    let envSkills = [];
    if (process.env.ANTHROPIC_API_SKILLS_JSON) {
        try {
            const parsed = JSON.parse(process.env.ANTHROPIC_API_SKILLS_JSON);
            envSkills = Array.isArray(parsed) ? parsed : [];
        } catch  {
            envSkills = [];
        }
    }
    return [
        ...storeSkills,
        ...envSkills
    ].filter((skill)=>{
        if (!skill || typeof skill !== "object") {
            return false;
        }
        const candidate = skill;
        return typeof candidate.skill_id === "string" && (candidate.type === "anthropic" || candidate.type === "custom");
    }).map((skill)=>({
            skill_id: skill.skill_id,
            type: skill.type,
            version: skill.version || "latest"
        }));
}
function textFromContent(content) {
    return content.filter((block)=>block.type === "text").map((block)=>block.text).join("");
}
function toolUses(content) {
    return content.filter((block)=>block.type === "tool_use");
}
async function appendUserMessage(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateData"])((data)=>{
        const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
        const message = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("msg"),
            sessionId: input.sessionId,
            role: "user",
            content: input.content,
            fileIds: input.fileIds,
            toolInvocationIds: [],
            createdAt: now
        };
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addMessageToData"])(data, message);
        const session = data.sessions.find((item)=>item.id === input.sessionId);
        if (session && input.fileIds.length) {
            session.fileIds = Array.from(new Set([
                ...session.fileIds,
                ...input.fileIds
            ]));
        }
        return message;
    });
}
async function runAssistantTurn(input) {
    const client = getClient();
    const model = input.model?.trim() || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getClaudeModel"])();
    if (!client) {
        const fallback = "ANTHROPIC_API_KEY is not configured. Add it to .env.local, restart npm run dev, then this workspace will send messages to Claude API. Local project, memory, file, session, and Markdown artifact features are still available.";
        input.send("delta", {
            text: fallback
        });
        const assistant = await saveAssistantMessage({
            sessionId: input.sessionId,
            model,
            content: fallback,
            toolInvocationIds: []
        });
        input.send("done", {
            message: assistant
        });
        return;
    }
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readData"])();
    const project = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findProject"])(data, input.projectId);
    const session = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findSession"])(data, input.sessionId);
    const history = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$context$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sessionMessages"])(data, session);
    const system = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$context$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildSystemPrompt"])(data, project, session);
    const workingMessages = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$context$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildAnthropicMessages"])(history);
    const assistantTextParts = [];
    const toolInvocationIds = [];
    const apiSkills = configuredApiSkills(data, project);
    const useApiSkills = process.env.ANTHROPIC_ENABLE_API_SKILLS === "true" && apiSkills.length > 0;
    for(let iteration = 0; iteration < 3; iteration += 1){
        const params = {
            model,
            max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 4096),
            system,
            messages: workingMessages,
            tools: input.toolsEnabled ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LOCAL_TOOLS"] : undefined
        };
        const betaMessages = client.beta.messages;
        const stream = useApiSkills ? betaMessages.stream({
            ...params,
            betas: [
                "skills-2025-10-02"
            ],
            container: {
                skills: apiSkills
            }
        }) : client.messages.stream(params);
        stream.on("text", (text)=>{
            assistantTextParts.push(text);
            input.send("delta", {
                text
            });
        });
        const finalMessage = await stream.finalMessage();
        const uses = toolUses(finalMessage.content);
        workingMessages.push({
            role: "assistant",
            content: finalMessage.content
        });
        if (!input.toolsEnabled || uses.length === 0) {
            break;
        }
        const toolResults = [];
        for (const toolUse of uses){
            input.send("tool", {
                name: toolUse.name,
                input: toolUse.input,
                status: "running"
            });
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tools$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runTool"])(toolUse.name, toolUse.input, {
                data,
                sessionId: input.sessionId,
                projectId: project.id,
                messageId: null
            });
            if (result && typeof result === "object" && "invocationId" in result && typeof result.invocationId === "string") {
                toolInvocationIds.push(result.invocationId);
            }
            input.send("tool", {
                name: toolUse.name,
                input: toolUse.input,
                output: result,
                status: "success"
            });
            toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result)
            });
        }
        workingMessages.push({
            role: "user",
            content: toolResults
        });
    }
    const dataAfterTools = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readData"])();
    const sessionAfterTools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findSession"])(dataAfterTools, input.sessionId);
    const newArtifacts = dataAfterTools.artifacts.filter((artifact)=>sessionAfterTools.artifactIds.includes(artifact.id));
    const content = assistantTextParts.join("").trim() || textFromContent(workingMessages.at(-1)?.content ?? []);
    const assistant = await saveAssistantMessage({
        sessionId: input.sessionId,
        model,
        content: content || "Done.",
        toolInvocationIds
    });
    input.send("done", {
        message: assistant,
        artifacts: newArtifacts.slice(0, 6)
    });
}
async function saveAssistantMessage(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateData"])((data)=>{
        const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
        const message = {
            id: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ids$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createId"])("msg"),
            sessionId: input.sessionId,
            role: "assistant",
            content: input.content,
            model: input.model,
            fileIds: [],
            toolInvocationIds: input.toolInvocationIds,
            createdAt: now
        };
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addMessageToData"])(data, message);
        return message;
    });
}
}),
"[project]/src/app/api/chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic,
    "maxDuration",
    ()=>maxDuration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-route] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$claude$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/claude.ts [app-route] (ecmascript)");
;
;
const dynamic = "force-dynamic";
const maxDuration = 120;
const chatSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    sessionId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    projectId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string(),
    message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1),
    fileIds: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string()).default([]),
    model: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().optional(),
    toolsEnabled: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].boolean().default(true)
});
function sse(event, payload) {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}
async function POST(request) {
    const body = chatSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start (controller) {
            const send = (event, payload)=>{
                controller.enqueue(encoder.encode(sse(event, payload)));
            };
            try {
                const userMessage = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$claude$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["appendUserMessage"])({
                    sessionId: body.sessionId,
                    projectId: body.projectId,
                    content: body.message,
                    fileIds: body.fileIds
                });
                send("user", {
                    message: userMessage
                });
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$claude$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runAssistantTurn"])({
                    sessionId: body.sessionId,
                    projectId: body.projectId,
                    model: body.model,
                    toolsEnabled: body.toolsEnabled,
                    send
                });
            } catch (error) {
                send("error", {
                    message: error instanceof Error ? error.message : "Unknown chat error."
                });
            } finally{
                controller.close();
            }
        }
    });
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive"
        }
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1gl112u._.js.map