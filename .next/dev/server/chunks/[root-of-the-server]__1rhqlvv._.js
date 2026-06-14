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
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
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
"[project]/src/app/api/sessions/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v4/classic/external.js [app-route] (ecmascript) <export * as z>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/store.ts [app-route] (ecmascript)");
;
;
const dynamic = "force-dynamic";
const createSessionSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    projectId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1),
    title: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v4$2f$classic$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(80).optional()
});
async function POST(request) {
    const body = createSessionSchema.parse(await request.json());
    const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSession"])(body.projectId, body.title);
    return Response.json({
        session
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1rhqlvv._.js.map