import { marked } from '/node_modules/marked/lib/marked.esm.js';

const STORAGE_KEY = 'nafisClaudeWorkspace:v2';
const CONTEXT_CHAR_BUDGET = 3_200_000;
const SESSION_SUMMARY_TRIGGER = 14;
const MEMORY_UPDATE_TURN_INTERVAL = 6;
const MAX_PROJECT_FILE_BYTES = 500_000;
const MAX_PROJECT_TOTAL_BYTES = 1_200_000;
const MAX_PROJECT_FILES = 12;
const PROJECT_FILE_EXTENSIONS = new Set(['md', 'txt', 'json', 'csv', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'xml', 'yaml', 'yml']);

const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
const MEMORY_SECTION_TITLES = [
  'Purpose & context',
  'Current state',
  'On the horizon',
  'Key learnings & principles',
  'Approach & patterns',
  'Tools & resources',
];

const defaultModels = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'max', detail: 'Reasoning maksimum.' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7', tier: 'max', detail: 'Reasoning mendalam.' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', tier: 'max', detail: 'Reasoning paling mendalam.' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'default', detail: 'Default untuk kerja harian dan arsitektur.' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'fast', detail: 'Cepat dan hemat.' },
];

const defaultSkills = [
  {
    id: 'confluence',
    name: 'Confluence',
    active: false,
    builtin: true,
    description: 'Cari halaman, baca ruang kerja, dan rangkum dokumen internal jika konektor tersedia.',
    triggerKeywords: ['confluence', 'wiki', 'page', 'halaman', 'dokumen internal'],
    content: 'Gunakan skill ini saat user meminta konteks dari Confluence. Jelaskan jika konektor belum tersedia dan jangan mengarang isi halaman.',
  },
  {
    id: 'generate-file',
    name: 'Generate File',
    active: true,
    builtin: true,
    description: 'Membuat dokumen, kode, dan artefak sebagai file yang bisa dibuka/diunduh.',
    triggerKeywords: ['file', 'generate', 'buat dokumen', '.md', '.txt', '.json', '.js'],
    content: 'Saat user meminta file, hasilkan konten siap pakai, beri nama file jelas, dan simpan sebagai artefak percakapan.',
  },
  {
    id: 'product-analysis',
    name: 'Analisis Produk',
    active: true,
    builtin: true,
    description: 'Menyusun PRD, roadmap, metrik, dan riset kompetitor.',
    triggerKeywords: ['prd', 'roadmap', 'produk', 'metric', 'metrik', 'riset'],
    content: 'Gunakan struktur produk: masalah, target user, asumsi, fitur, metrik sukses, risiko, dan next steps.',
  },
  {
    id: 'ui-design',
    name: 'Desain UI',
    active: true,
    builtin: true,
    description: 'Memberi kritik visual dan menghasilkan spesifikasi antarmuka.',
    triggerKeywords: ['ui', 'ux', 'design', 'desain', 'interface'],
    content: 'Nilai UI dari hierarchy, spacing, contrast, affordance, accessibility, responsive behavior, dan microcopy.',
  },
];

const promptToolCommands = [
  { id: 'atlassian_confluence_search', command: 'confluence-search', label: 'Search Confluence', description: 'Cari halaman Confluence dari kata kunci.' },
  { id: 'atlassian_confluence_get_page', command: 'confluence-page', label: 'Read Confluence page', description: 'Baca satu halaman Confluence berdasarkan page ID.' },
  { id: 'atlassian_confluence_update_page', command: 'confluence-update', label: 'Update Confluence page', description: 'Perbarui halaman Confluence setelah membaca versi terbaru.' },
  { id: 'atlassian_jira_search', command: 'jira-search', label: 'Search Jira', description: 'Cari issue Jira dengan teks atau JQL.' },
  { id: 'atlassian_jira_get_issue', command: 'jira-issue', label: 'Read Jira issue', description: 'Baca satu issue Jira berdasarkan issue key.' },
  { id: 'atlassian_jira_create_issue', command: 'jira-create', label: 'Create Jira issue', description: 'Buat issue Jira saat diminta secara eksplisit.' },
  { id: 'atlassian_jira_update_issue', command: 'jira-update', label: 'Update Jira issue', description: 'Perbarui field issue Jira yang dipilih.' },
  { id: 'atlassian_jira_add_comment', command: 'jira-comment', label: 'Comment on Jira issue', description: 'Tambahkan komentar ke issue Jira.' },
];

const defaultProjects = [
  {
    id: 'nova',
    name: 'NovaX Edtech',
    systemPrompt: 'Gunakan Bahasa Indonesia, fokus pada edtech B2B, target sekolah dan bootcamp.',
    memory: 'Gunakan Bahasa Indonesia, fokus pada edtech B2B, target sekolah dan bootcamp.',
    color: 'apricot',
  },
  {
    id: 'game',
    name: 'AI Game Lab',
    systemPrompt: 'Preferensi: prototype cepat, agent NPC, Godot/Unity ringan, gameplay dulu baru visual.',
    memory: 'Preferensi: prototype cepat, agent NPC, Godot/Unity ringan, gameplay dulu baru visual.',
    color: 'sage',
  },
  {
    id: 'ops',
    name: 'Operasional Pribadi',
    systemPrompt: 'Prioritaskan ringkasan eksekutif, checklist mingguan, dan integrasi dokumen kerja.',
    memory: 'Prioritaskan ringkasan eksekutif, checklist mingguan, dan integrasi dokumen kerja.',
    color: 'violet',
  },
];

const welcomeMessage = {
  id: crypto.randomUUID(),
  role: 'assistant',
  text: 'Malam, siffan. Saya siap membantu lewat chat, memori proyek, skill, dan artefak file.',
  createdAt: new Date().toISOString(),
};

const defaultBriefContent = '# Brief Proyek\n\nGunakan panel ini untuk menyimpan context project yang dapat diretrieve oleh AI.';
const defaultProjectFile = {
  id: crypto.randomUUID(),
  name: 'brief-proyek.md',
  type: 'text/markdown',
  size: new Blob([defaultBriefContent]).size,
  content: defaultBriefContent,
  included: true,
  addedAt: new Date().toISOString(),
};

const initialState = {
  model: DEFAULT_MODEL_ID,
  tone: 'Sedang',
  apiKey: '',
  apiKeySaved: false,
  view: 'chat',
  settingsOpen: false,
  settingsSection: 'general',
  sidebarCollapsed: false,
  profile: { fullName: 'nafis', callName: 'nafis', work: '' },
  customProjects: [],
  activeProject: null,
  activeConversation: 1,
  activeArtifact: null,
  activeSkill: 'generate-file',
  skillViewMode: 'preview',
  skillFileError: '',
  customizeSection: 'skills',
  skillModalMode: null,
  uninstalledSkillIds: [],
  connectorStatus: { loading: false, connected: false, baseUrl: '', email: '', source: '', displayName: '', checkedAt: '', error: '' },
  connectorBusy: '',
  projectMemoryEditing: false,
  projectInstructionModalOpen: false,
  projectInstructions: {},
  projectFiles: { nova: [defaultProjectFile] },
  projectFilesMigrated: true,
  projectFileError: '',
  memoryModalScope: null,
  memoryModalEditing: false,
  isSending: false,
  isMemoryUpdating: false,
  streamingMessageId: null,
  promptDraft: '',
  promptCommands: [],
  tokenCount: null,
  error: '',
  globalMemory: '',
  projectMemories: {},
  sessionSummaries: {},
  contextStats: {},
  memoryUpdatedAt: { global: '', projects: {}, sessions: {} },
  conversations: [
    { id: 1, title: 'Tanpa judul', projectId: null, model: DEFAULT_MODEL_ID, preview: 'Sesi mandiri', updated: 'Baru saja' },
    { id: 2, title: 'AI game sederhana vs LLM untuk NPC', projectId: 'game', model: DEFAULT_MODEL_ID, preview: 'Eksperimen gameplay dan prompt', updated: '2 jam lalu' },
    { id: 3, title: 'Perbedaan Claude di app vs API usage', projectId: null, model: DEFAULT_MODEL_ID, preview: 'Catatan umum lintas proyek', updated: 'Kemarin' },
    { id: 4, title: 'Desain arsitektur yang sudah siap MVP', projectId: 'nova', model: DEFAULT_MODEL_ID, preview: 'Backend, auth, dan billing', updated: 'Senin' },
  ],
  messagesByConversation: {
    1: [welcomeMessage],
    2: [{ ...welcomeMessage, id: crypto.randomUUID(), text: 'Project AI Game Lab aktif. Mau kita rancang NPC, gameplay loop, atau prototype teknis dulu?' }],
    3: [{ ...welcomeMessage, id: crypto.randomUUID(), text: 'Kita bisa bahas perbedaan Claude app dan API dari sisi fitur, pricing, latency, dan integrasi.' }],
    4: [{ ...welcomeMessage, id: crypto.randomUUID(), text: 'Project NovaX aktif. Saya akan mempertahankan konteks edtech B2B saat menjawab.' }],
  },
  artifacts: [
    {
      id: crypto.randomUUID(),
      type: 'doc',
      name: 'brief-proyek.md',
      detail: 'Contoh artefak awal yang bisa dibuka dan diunduh.',
      content: '# Brief Proyek\n\nGunakan panel ini untuk menyimpan output Claude-like sebagai file nyata di browser.',
      createdAt: new Date().toISOString(),
    },
  ],
};

let state = loadState();
const app = document.querySelector('#app');

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialState);

  try {
    const stored = JSON.parse(raw);
    const conversations = (stored.conversations || initialState.conversations).map((conversation) => ({
      ...conversation,
      model: defaultModels.some((model) => model.id === conversation.model) ? conversation.model : DEFAULT_MODEL_ID,
    }));
    return {
      ...structuredClone(initialState),
      ...stored,
      model: defaultModels.some((model) => model.id === stored.model) ? stored.model : DEFAULT_MODEL_ID,
      conversations,
      apiKey: stored.apiKeySaved ? stored.apiKey || '' : '',
      isSending: false,
      isMemoryUpdating: false,
      error: '',
      streamingMessageId: null,
      promptDraft: '',
      promptCommands: [],
      tokenCount: stored.tokenCount || null,
      projectMemories: stored.projectMemories || {},
      sessionSummaries: stored.sessionSummaries || {},
      contextStats: stored.contextStats || {},
      memoryUpdatedAt: stored.memoryUpdatedAt || { global: '', projects: {}, sessions: {} },
      activeSkill: stored.activeSkill || 'generate-file',
      skillViewMode: stored.skillViewMode === 'raw' ? 'raw' : 'preview',
      skillFileError: '',
      customizeSection: stored.customizeSection === 'connectors' ? 'connectors' : 'skills',
      view: ['chat', 'projects', 'project', 'customize', 'artifacts'].includes(stored.view) ? stored.view : 'chat',
      settingsOpen: false,
      settingsSection: stored.settingsSection || 'general',
      sidebarCollapsed: Boolean(stored.sidebarCollapsed),
      profile: { ...initialState.profile, ...(stored.profile || {}) },
      customProjects: stored.customProjects || [],
      skillModalMode: null,
      uninstalledSkillIds: stored.uninstalledSkillIds || [],
      connectorStatus: { ...initialState.connectorStatus },
      connectorBusy: '',
      projectMemoryEditing: false,
      projectInstructionModalOpen: false,
      projectInstructions: stored.projectInstructions || {},
      projectFiles: stored.projectFilesMigrated
        ? stored.projectFiles || {}
        : {
            ...(stored.projectFiles || {}),
            nova: (stored.projectFiles?.nova?.length
              ? stored.projectFiles.nova
              : (stored.artifacts || []).filter((artifact) => artifact.name === 'brief-proyek.md').map((artifact) => ({
                  id: crypto.randomUUID(),
                  name: artifact.name,
                  type: 'text/markdown',
                  size: new Blob([artifact.content || '']).size,
                  content: artifact.content || '',
                  included: true,
                  addedAt: artifact.createdAt || new Date().toISOString(),
                }))),
          },
      projectFilesMigrated: true,
      projectFileError: '',
      memoryModalScope: null,
      memoryModalEditing: false,
    };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  const {
    connectorStatus,
    connectorBusy,
    skillFileError,
    promptDraft,
    promptCommands,
    projectInstructionModalOpen,
    projectFileError,
    ...persistableState
  } = state;
  const persisted = {
    ...persistableState,
    apiKey: state.apiKeySaved ? state.apiKey : '',
    isSending: false,
    isMemoryUpdating: false,
    error: '',
    streamingMessageId: null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function modelById(id) {
  return defaultModels.find((model) => model.id === id) ?? defaultModels.find((model) => model.id === DEFAULT_MODEL_ID) ?? defaultModels[0];
}

function currentModelId() {
  return currentConversation()?.model || state.model || DEFAULT_MODEL_ID;
}

function projectById(id) {
  return [...defaultProjects, ...(state.customProjects || [])].find((project) => project.id === id) ?? null;
}

function allProjects() {
  return [...defaultProjects, ...(state.customProjects || [])];
}

function currentConversation() {
  return state.conversations.find((conversation) => conversation.id === state.activeConversation) ?? state.conversations[0];
}

function currentMessages() {
  return state.messagesByConversation[state.activeConversation] ?? [];
}

function conversationById(id) {
  return state.conversations.find((conversation) => conversation.id === id) || null;
}

function nextConversationId() {
  return Math.max(Date.now(), ...state.conversations.map((conversation) => Number(conversation.id) || 0)) + 1;
}

function generatedProjectMemory(projectId) {
  return state.projectMemories?.[projectId] || '';
}

function projectInstruction(project) {
  if (!project) return '';
  if (Object.prototype.hasOwnProperty.call(state.projectInstructions || {}, project.id)) {
    return state.projectInstructions[project.id] || '';
  }
  return project.systemPrompt || project.memory || '';
}

function projectFiles(projectId) {
  return state.projectFiles?.[projectId] || [];
}

function selectedProjectFiles(projectId) {
  return projectFiles(projectId)
    .filter((file) => file.included !== false)
    .map((file) => ({ name: file.name, type: file.type || 'text/plain', content: file.content }));
}

function combineProjectMemory(project) {
  if (!project) return null;
  const generatedMemory = generatedProjectMemory(project.id);
  return {
    ...project,
    baseMemory: project.memory,
    systemPrompt: projectInstruction(project),
    files: selectedProjectFiles(project.id),
    generatedMemory,
    memory: [project.memory, generatedMemory && `Generated memory:\n${generatedMemory}`].filter(Boolean).join('\n\n'),
  };
}

function activeMemory() {
  const conversationProject = projectById(currentConversation()?.projectId);
  const selectedProject = projectById(state.activeProject);
  return combineProjectMemory(selectedProject ?? conversationProject);
}

function activeSkills() {
  const storedSkills = state.skills || [];
  const uninstalledSkillIds = new Set(state.uninstalledSkillIds || []);
  const builtinIds = defaultSkills.map((skill) => skill.id);
  const mergedBuiltins = defaultSkills.map((skill) => ({ ...skill, ...(storedSkills.find((item) => item.id === skill.id) || {}) }));
  const customSkills = storedSkills.filter((skill) => !builtinIds.includes(skill.id));
  return [...mergedBuiltins, ...customSkills].filter((skill) => !uninstalledSkillIds.has(skill.id));
}

function selectedSkill() {
  return activeSkills().find((skill) => skill.id === state.activeSkill) || activeSkills()[0];
}

function skillAsMarkdown(skill) {
  return [
    '---',
    `name: ${JSON.stringify(skill.name || 'Untitled skill')}`,
    `description: ${JSON.stringify(skill.description || '')}`,
    `trigger_keywords: ${JSON.stringify(skill.triggerKeywords || [])}`,
    `active: ${skill.active ? 'true' : 'false'}`,
    '---',
    '',
    `# ${skill.name}`,
    '',
    skill.content || '-',
  ].join('\n');
}

function commandSlug(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function promptCommandOptions() {
  const skillCommands = activeSkills()
    .filter((skill) => skill.active)
    .map((skill) => ({
      key: `skill:${skill.id}`,
      kind: 'skill',
      command: commandSlug(skill.name) || commandSlug(skill.id),
      label: skill.name,
      description: skill.description || 'Jalankan skill ini untuk prompt berikutnya.',
      target: skill.id,
    }));
  const toolCommands = promptToolCommands.map((tool) => ({
    key: `tool:${tool.id}`,
    kind: 'tool',
    command: tool.command,
    label: tool.label,
    description: tool.description,
    target: tool.id,
  }));
  return [...skillCommands, ...toolCommands];
}

function selectedPromptTriggers() {
  const commands = state.promptCommands || [];
  return {
    explicitSkillIds: commands.filter((command) => command.kind === 'skill').map((command) => command.target),
    explicitToolNames: commands.filter((command) => command.kind === 'tool').map((command) => command.target),
  };
}

function sanitizeMarkdownHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, style, iframe, object, embed, form').forEach((element) => element.remove());
  template.content.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
        element.removeAttribute(attribute.name);
      }
    });
    if (element.tagName === 'A') {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noreferrer noopener');
    }
  });
  return template.innerHTML;
}

function renderMarkdown(source = '') {
  return sanitizeMarkdownHtml(marked.parse(source, {
    breaks: true,
    gfm: true,
  }));
}

function skillMarkdownBody(skill) {
  return parseFrontmatter(skillAsMarkdown(skill)).body;
}

function setState(patch, persist = true) {
  state = { ...state, ...patch };
  if (persist) saveState();
  render();
}

function titleFromPrompt(prompt) {
  return prompt.length > 44 ? `${prompt.slice(0, 44)}…` : prompt || 'Tanpa judul';
}

function updateConversationPreview(prompt) {
  state.conversations = state.conversations.map((conversation) => {
    if (conversation.id !== state.activeConversation) return conversation;
    return {
      ...conversation,
      title: conversation.title === 'Tanpa judul' ? titleFromPrompt(prompt) : conversation.title,
      preview: prompt.slice(0, 72),
      updated: 'Baru saja',
      projectId: state.activeProject,
      model: conversation.model || currentModelId(),
    };
  });
}

function detectActions(prompt, assistantText = '') {
  const actions = [];
  const fileSkill = activeSkills().find((skill) => skill.id === 'generate-file');

  if (fileSkill?.active && /(buat|generate|hasilkan|tulis).*(file|\.md|\.txt|\.json|\.js|dokumen)/i.test(prompt)) {
    actions.push({ type: 'file', name: suggestFileName(prompt), detail: 'Artefak dibuat dari respons assistant dan bisa dibuka/diunduh.' });
  }

  if (fileSkill?.active && assistantText && /(roadmap|prd|brief|spesifikasi|kode|dokumen)/i.test(prompt) && !actions.some((action) => action.type === 'file')) {
    actions.push({ type: 'file', name: suggestFileName(prompt), detail: 'Output penting disimpan sebagai artefak untuk dipakai ulang.' });
  }

  return actions;
}

function suggestFileName(prompt) {
  const match = prompt.match(/[\w-]+\.(md|txt|json|js|ts|html|css)/i);
  if (match) return match[0].toLowerCase();
  if (/roadmap/i.test(prompt)) return 'roadmap.md';
  if (/prd/i.test(prompt)) return 'prd.md';
  if (/kode|code|script/i.test(prompt)) return 'generated-code.js';
  return 'generated-output.md';
}

function createArtifactFromAction(action, content) {
  return {
    id: crypto.randomUUID(),
    type: action.type,
    name: action.name,
    detail: action.detail,
    content: content || `# ${action.name}\n\nBelum ada konten.`,
    createdAt: new Date().toISOString(),
  };
}


function userTurnCount(messages = currentMessages()) {
  return messages.filter((message) => message.role === 'user').length;
}

function estimateChars(messages = []) {
  return messages.reduce((total, message) => total + String(message.text || '').length, 0);
}

function currentSessionSummary() {
  return state.sessionSummaries?.[state.activeConversation] || '';
}

function currentContextStats() {
  const messages = currentMessages();
  const recentMessages = buildContextMessages();
  const summary = currentSessionSummary();
  return {
    totalMessages: messages.length,
    sentMessages: recentMessages.length,
    totalChars: estimateChars(messages),
    sentChars: estimateChars(recentMessages),
    hasSummary: Boolean(summary),
  };
}

function buildContextMessages() {
  const messages = currentMessages().filter((message) => ['user', 'assistant'].includes(message.role) && message.text);
  const result = [];
  let totalChars = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const chars = JSON.stringify({ role: message.role, content: message.text }).length;
    if (result.length && totalChars + chars > CONTEXT_CHAR_BUDGET) break;
    result.unshift(message);
    totalChars += chars;
  }

  while (result.length && result[0].role !== 'user') result.shift();
  return result;
}

function contextMeta() {
  const stats = currentContextStats();
  return `Mengirim ${stats.sentMessages}/${stats.totalMessages} pesan (${stats.sentChars}/${stats.totalChars} karakter) + ${stats.hasSummary ? 'session summary' : 'tanpa summary'} + memory.`;
}

async function refreshTokenCount(triggers = selectedPromptTriggers()) {
  if (!state.apiKey) return;
  try {
    const response = await fetch('/api/count-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey: state.apiKey,
        model: currentModelId(),
        tone: state.tone,
        project: activeMemory(),
        globalMemory: state.globalMemory,
        sessionSummary: currentSessionSummary(),
        contextMeta: contextMeta(),
        skills: activeSkills(),
        ...triggers,
        messages: buildContextMessages(),
      }),
    });
    const payload = await response.json();
    if (response.ok) {
      state.tokenCount = payload.input_tokens ?? payload.token_count ?? null;
      saveState();
      render();
    }
  } catch {
    // Token counting is optional; chat should not be blocked by it.
  }
}

function hasHighValueMemorySignal(messages = currentMessages()) {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  return /\b(ingat|remember|mulai sekarang|prefer|saya suka|saya tidak suka|jangan lagi|keputusan|diputuskan|final|source of truth|north star|prioritas|constraint|batasan|nama saya|tim saya|project ini)\b/i.test(latestUser?.text || '');
}

function shouldUpdateMemories(messages = currentMessages(), conversationId = state.activeConversation) {
  const stats = state.contextStats?.[conversationId] || {};
  return hasHighValueMemorySignal(messages)
    || userTurnCount(messages) - (stats.lastMemoryTurn || 0) >= MEMORY_UPDATE_TURN_INTERVAL;
}

function shouldSummarizeSession(messages = currentMessages(), conversationId = state.activeConversation) {
  const stats = state.contextStats?.[conversationId] || {};
  return messages.length - (stats.summarizedThrough || 0) >= SESSION_SUMMARY_TRIGGER;
}

async function requestMemory(scope, existingMemory, context) {
  const response = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey: state.apiKey,
      model: 'claude-haiku-4-5-20251001',
      maxTokens: scope === 'session' ? 900 : 1800,
      scope,
      existingMemory,
      project: context.project,
      messages: context.messages,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Generate memory gagal.');
  return payload.memory || existingMemory || '';
}

function markMemoryGenerated(scopes, { conversationId, projectId }) {
  const now = new Date().toISOString();
  state.memoryUpdatedAt = {
    ...state.memoryUpdatedAt,
    global: scopes.includes('global') ? now : state.memoryUpdatedAt?.global || '',
    projects: {
      ...(state.memoryUpdatedAt?.projects || {}),
      ...(scopes.includes('project') && projectId ? { [projectId]: now } : {}),
    },
    sessions: {
      ...(state.memoryUpdatedAt?.sessions || {}),
      ...(scopes.includes('session') ? { [conversationId]: now } : {}),
    },
  };
}

async function generateMemories(scopes = ['session', 'global', 'project'], force = false) {
  if (state.isMemoryUpdating || !state.apiKey) return;
  const conversationId = state.activeConversation;
  const messages = [...currentMessages()];
  const project = activeMemory();
  const projectId = project?.id || null;
  const updateDurableMemory = force || shouldUpdateMemories(messages, conversationId);
  const updateSession = force || shouldSummarizeSession(messages, conversationId);
  if (!updateDurableMemory && !updateSession) return;

  const jobs = [];
  if (scopes.includes('session') && updateSession) {
    jobs.push({ scope: 'session', promise: requestMemory('session', state.sessionSummaries?.[conversationId] || '', { messages, project }) });
  }
  if (scopes.includes('global') && updateDurableMemory) {
    jobs.push({ scope: 'global', promise: requestMemory('global', state.globalMemory, { messages, project }) });
  }
  if (project && scopes.includes('project') && updateDurableMemory) {
    jobs.push({ scope: 'project', promise: requestMemory('project', generatedProjectMemory(projectId), { messages, project }) });
  }
  if (!jobs.length) return;

  state.isMemoryUpdating = true;
  saveState();
  render();

  const completed = [];
  const failures = [];
  const results = await Promise.allSettled(jobs.map((job) => job.promise));
  results.forEach((result, index) => {
    const scope = jobs[index].scope;
    if (result.status === 'rejected') {
      failures.push(result.reason?.message || `${scope} memory gagal.`);
      return;
    }
    completed.push(scope);
    if (scope === 'session') state.sessionSummaries = { ...state.sessionSummaries, [conversationId]: result.value };
    if (scope === 'global') state.globalMemory = result.value;
    if (scope === 'project' && projectId) state.projectMemories = { ...state.projectMemories, [projectId]: result.value };
  });

  if (completed.length) {
    const stats = state.contextStats?.[conversationId] || {};
    state.contextStats = {
      ...state.contextStats,
      [conversationId]: {
        ...stats,
        ...(completed.some((scope) => scope === 'global' || scope === 'project') ? { lastMemoryTurn: userTurnCount(messages) } : {}),
        ...(completed.includes('session') ? { summarizedThrough: messages.length } : {}),
      },
    };
    markMemoryGenerated(completed, { conversationId, projectId });
  }
  if (failures.length) state.error = failures.join(' ');
  state.isMemoryUpdating = false;
  saveState();
  render();
}

function createLocalFallback(prompt) {
  const memory = activeMemory();
  const actions = detectActions(prompt);
  const text = [
    'Mode lokal aktif karena API key belum tersedia atau request gagal.',
    memory ? `Memori proyek yang dipakai: ${memory.name} — ${memory.memory}` : '',
    'Tambahkan API key Claude melalui Pengaturan agar jawaban datang dari backend proxy `/api/chat-stream` dan model yang dipilih.',
  ].filter(Boolean).join('\n\n');
  return { text, actions };
}

function setConnectorState(patch) {
  state = {
    ...state,
    connectorStatus: { ...state.connectorStatus, ...patch },
  };
  render();
}

async function connectorRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Connector request gagal (${response.status}).`);
  return data;
}

async function loadAtlassianConnectorStatus() {
  setConnectorState({ loading: true, error: '' });
  try {
    const status = await connectorRequest('/api/connectors/atlassian');
    setConnectorState({ ...status, loading: false, error: '' });
  } catch (error) {
    setConnectorState({ loading: false, error: error.message });
  }
}

async function connectAtlassian() {
  const baseUrl = document.querySelector('#atlassian-base-url')?.value.trim() || '';
  const email = document.querySelector('#atlassian-email')?.value.trim() || '';
  const apiToken = document.querySelector('#atlassian-api-token')?.value.trim() || '';
  if (!baseUrl || !email || !apiToken) {
    setConnectorState({ error: 'Isi site URL, email, dan API token terlebih dahulu.' });
    return;
  }
  state.connectorBusy = 'connect';
  setConnectorState({ error: '' });
  try {
    const status = await connectorRequest('/api/connectors/atlassian/connect', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, email, apiToken }),
    });
    state.connectorBusy = '';
    setConnectorState({ ...status, loading: false, error: '' });
  } catch (error) {
    state.connectorBusy = '';
    setConnectorState({ error: error.message });
  }
}

async function testAtlassianConnector() {
  state.connectorBusy = 'test';
  setConnectorState({ error: '' });
  try {
    const status = await connectorRequest('/api/connectors/atlassian/test', { method: 'POST', body: '{}' });
    state.connectorBusy = '';
    setConnectorState({ ...status, error: '' });
  } catch (error) {
    state.connectorBusy = '';
    setConnectorState({ error: error.message });
  }
}

async function disconnectAtlassian() {
  state.connectorBusy = 'disconnect';
  setConnectorState({ error: '' });
  try {
    const status = await connectorRequest('/api/connectors/atlassian/disconnect', { method: 'POST', body: '{}' });
    state.connectorBusy = '';
    setConnectorState({ ...status, displayName: '', checkedAt: '', error: '' });
  } catch (error) {
    state.connectorBusy = '';
    setConnectorState({ error: error.message });
  }
}

async function requestClaude(prompt, assistantId, conversationId, triggers = {}) {
  const response = await fetch('/api/chat-stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey: state.apiKey,
      model: currentModelId(),
      tone: state.tone,
      project: activeMemory(),
      globalMemory: state.globalMemory,
      sessionSummary: currentSessionSummary(),
      contextMeta: contextMeta(),
      skills: activeSkills(),
      explicitSkillIds: triggers.explicitSkillIds || [],
      explicitToolNames: triggers.explicitToolNames || [],
      messages: buildContextMessages(),
    }),
  });

  if (!response.ok || !response.body) {
    let payload = {};
    try { payload = await response.json(); } catch {}
    throw new Error(payload.error || 'Claude API gagal merespons.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines = [];
  let text = '';
  let usage = null;
  let model = currentModelId();
  const toolActions = [];

  function updateAssistantText(nextText) {
    const messages = state.messagesByConversation[conversationId] || [];
    state.messagesByConversation[conversationId] = messages.map((message) => (
      message.id === assistantId ? { ...message, text: nextText || '…', actions: toolActions, usage, model } : message
    ));
    saveState();
    render();
  }

  function handleStreamEvent() {
    if (!dataLines.length) return;
    let payload;
    try { payload = JSON.parse(dataLines.join('\n')); } catch { payload = {}; }
    dataLines = [];

    if (eventName === 'delta') {
      text += payload.text || '';
      updateAssistantText(text);
    }
    if (eventName === 'tool') {
      toolActions.push({ type: 'tool', name: payload.name || 'Atlassian', detail: payload.content || payload.status || '' });
      updateAssistantText(text || 'Menggunakan Atlassian…');
    }
    if (eventName === 'done') {
      usage = payload.usage || usage;
      model = payload.model || model;
      if (payload.text && !text) text = payload.text;
    }
    if (eventName === 'error') {
      throw new Error(payload.error || 'Claude API gagal merespons.');
    }
    eventName = '';
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line) {
        handleStreamEvent();
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }
  handleStreamEvent();

  return {
    text: text || 'Claude merespons tanpa teks.',
    usage,
    model,
    actions: [...toolActions, ...detectActions(prompt, text)],
  };
}


async function addMessage() {
  const input = document.querySelector('#prompt-input');
  const prompt = (input?.value || state.promptDraft || '').trim();
  if (!prompt || state.isSending) return;

  const conversationId = state.activeConversation;
  const triggers = selectedPromptTriggers();
  const userMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    text: prompt,
    triggerCommands: (state.promptCommands || []).map(({ kind, command, label }) => ({ kind, command, label })),
    createdAt: new Date().toISOString(),
  };
  const assistantId = crypto.randomUUID();
  const assistantPlaceholder = { id: assistantId, role: 'assistant', text: '', actions: [], model: currentModelId(), createdAt: new Date().toISOString() };

  state.messagesByConversation[conversationId] = currentMessages().concat(userMessage, assistantPlaceholder);
  updateConversationPreview(prompt);
  state.isSending = true;
  state.streamingMessageId = assistantId;
  state.promptDraft = '';
  state.promptCommands = [];
  state.error = '';
  saveState();
  render();
  refreshTokenCount(triggers);

  let reply;
  try {
    reply = await requestClaude(prompt, assistantId, conversationId, triggers);
  } catch (error) {
    reply = createLocalFallback(prompt);
    state.error = error.message;
  }

  const newArtifacts = reply.actions
    .filter((action) => action.type === 'file')
    .map((action) => createArtifactFromAction(action, reply.text));

  state.messagesByConversation[conversationId] = (state.messagesByConversation[conversationId] || []).map((message) => (
    message.id === assistantId
      ? { ...message, text: reply.text, actions: reply.actions, usage: reply.usage, model: reply.model, streaming: false }
      : message
  ));
  state.artifacts = [...newArtifacts, ...state.artifacts];
  state.activeArtifact = newArtifacts[0]?.id ?? state.activeArtifact;
  state.isSending = false;
  state.streamingMessageId = null;
  saveState();
  render();
  generateMemories();
}


function newConversation() {
  const id = Date.now();
  state.conversations = [{ id, title: 'Tanpa judul', projectId: null, model: currentModelId(), preview: 'Sesi baru', updated: 'Baru saja' }, ...state.conversations];
  state.messagesByConversation[id] = [{
    ...welcomeMessage,
    id: crypto.randomUUID(),
    text: 'Apa yang bisa saya bantu?',
  }];
  state.activeConversation = id;
  state.activeProject = null;
  state.view = 'chat';
  state.settingsOpen = false;
  saveState();
  render();
}

function branchConversation(throughMessageId = null) {
  if (state.isSending) return;
  const sourceConversation = currentConversation();
  const sourceMessages = currentMessages();
  const id = nextConversationId();
  let branch;
  try {
    branch = globalThis.NafisBranching.createConversationBranch({
      conversation: sourceConversation,
      messages: sourceMessages,
      throughMessageId,
      id,
      now: new Date().toISOString(),
      idFactory: () => crypto.randomUUID(),
    });
  } catch (error) {
    setState({ error: error.message });
    return;
  }

  state.conversations = [branch.conversation, ...state.conversations];
  state.messagesByConversation = { ...state.messagesByConversation, [id]: branch.messages };
  state.sessionSummaries = { ...state.sessionSummaries, [id]: '' };
  state.contextStats = { ...state.contextStats, [id]: { lastMemoryTurn: userTurnCount(branch.messages), summarizedThrough: 0 } };
  state.memoryUpdatedAt = {
    ...state.memoryUpdatedAt,
    sessions: { ...(state.memoryUpdatedAt?.sessions || {}), [id]: '' },
  };
  state.activeConversation = id;
  state.activeProject = branch.conversation.projectId ?? null;
  state.view = 'chat';
  state.settingsOpen = false;
  state.error = '';
  saveState();
  render();
}

function moveConversationToProject(projectId) {
  state.activeProject = projectId;
  state.conversations = state.conversations.map((conversation) => (
    conversation.id === state.activeConversation ? { ...conversation, projectId } : conversation
  ));
  saveState();
  render();
}

function downloadArtifact(artifactId) {
  const artifact = state.artifacts.find((item) => item.id === artifactId);
  if (!artifact) return;
  const blob = new Blob([artifact.content], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = artifact.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function copyArtifact(artifactId) {
  const artifact = state.artifacts.find((item) => item.id === artifactId);
  if (!artifact) return;
  navigator.clipboard.writeText(artifact.content);
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
}

function projectFileExtension(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || '';
}

function openProjectInstructionModal() {
  state.projectInstructionModalOpen = true;
  render();
  document.querySelector('#project-instruction-editor')?.focus();
}

function closeProjectInstructionModal() {
  setState({ projectInstructionModalOpen: false });
}

function saveProjectInstruction() {
  const project = projectById(state.activeProject);
  if (!project) return;
  const instruction = document.querySelector('#project-instruction-editor')?.value.trim() || '';
  state.projectInstructions = {
    ...(state.projectInstructions || {}),
    [project.id]: instruction,
  };
  state.projectInstructionModalOpen = false;
  saveState();
  render();
}

async function importProjectFiles(fileList) {
  const project = projectById(state.activeProject);
  if (!project) return;
  const incoming = [...(fileList || [])];
  if (!incoming.length) return;
  const current = projectFiles(project.id);
  const incomingNames = new Set(incoming.map((file) => file.name.toLowerCase()));
  const retained = current.filter((file) => !incomingNames.has(file.name.toLowerCase()));
  if (retained.length + incoming.length > MAX_PROJECT_FILES) {
    setState({ projectFileError: `Maksimal ${MAX_PROJECT_FILES} file per project.` }, false);
    return;
  }

  const invalid = incoming.find((file) => (
    !PROJECT_FILE_EXTENSIONS.has(projectFileExtension(file.name))
    || file.size > MAX_PROJECT_FILE_BYTES
  ));
  if (invalid) {
    const reason = invalid.size > MAX_PROJECT_FILE_BYTES
      ? `lebih besar dari ${formatFileSize(MAX_PROJECT_FILE_BYTES)}`
      : 'bukan file teks yang didukung';
    setState({ projectFileError: `${invalid.name} ${reason}.` }, false);
    return;
  }
  const totalBytes = retained.reduce((total, file) => total + Number(file.size || file.content?.length || 0), 0)
    + incoming.reduce((total, file) => total + file.size, 0);
  if (totalBytes > MAX_PROJECT_TOTAL_BYTES) {
    setState({ projectFileError: `Total file context maksimal ${formatFileSize(MAX_PROJECT_TOTAL_BYTES)} per project.` }, false);
    return;
  }

  try {
    const previousProjectFiles = state.projectFiles;
    const imported = await Promise.all(incoming.map(async (file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || 'text/plain',
      size: file.size,
      content: await file.text(),
      included: true,
      addedAt: new Date().toISOString(),
    })));
    state.projectFiles = {
      ...(state.projectFiles || {}),
      [project.id]: [
        ...retained,
        ...imported,
      ],
    };
    state.projectFileError = '';
    try {
      saveState();
    } catch {
      state.projectFiles = previousProjectFiles;
      throw new Error('Browser storage penuh.');
    }
    render();
  } catch (error) {
    setState({ projectFileError: error.message || 'File tidak dapat dibaca.' }, false);
  }
}

function toggleProjectFileContext(fileId) {
  const project = projectById(state.activeProject);
  if (!project) return;
  state.projectFiles = {
    ...(state.projectFiles || {}),
    [project.id]: projectFiles(project.id).map((file) => (
      file.id === fileId ? { ...file, included: file.included === false } : file
    )),
  };
  saveState();
  render();
}

function removeProjectFile(fileId) {
  const project = projectById(state.activeProject);
  if (!project) return;
  state.projectFiles = {
    ...(state.projectFiles || {}),
    [project.id]: projectFiles(project.id).filter((file) => file.id !== fileId),
  };
  state.projectFileError = '';
  saveState();
  render();
}


function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function copyText(content) {
  navigator.clipboard.writeText(content);
}

function focusSkillModalNameInput() {
  queueMicrotask(() => {
    const input = document.querySelector('#skill-modal-name');
    input?.focus();
    input?.select();
  });
}

function upsertSkill(nextSkill) {
  const skills = activeSkills();
  const exists = skills.some((skill) => skill.id === nextSkill.id);
  const nextSkills = exists
    ? skills.map((skill) => (skill.id === nextSkill.id ? { ...skill, ...nextSkill } : skill))
    : [...skills, nextSkill];
  setState({
    skills: nextSkills,
    activeSkill: nextSkill.id,
    skillModalMode: null,
    uninstalledSkillIds: (state.uninstalledSkillIds || []).filter((id) => id !== nextSkill.id),
  });
}

function openSkillModal(mode) {
  setState({ skillModalMode: mode });
  focusSkillModalNameInput();
}

function closeSkillModal() {
  setState({ skillModalMode: null });
}

function saveSkillModal() {
  const existingSkill = state.skillModalMode === 'edit' ? selectedSkill() : null;
  const name = document.querySelector('#skill-modal-name')?.value.trim() || '';
  const description = document.querySelector('#skill-modal-description')?.value.trim() || '';
  const content = document.querySelector('#skill-modal-instructions')?.value.trim() || '';
  if (!name || !description || !content) return;

  upsertSkill({
    id: existingSkill?.id || `custom-${Date.now()}`,
    name,
    active: existingSkill?.active ?? true,
    builtin: existingSkill?.builtin ?? false,
    description,
    triggerKeywords: existingSkill?.triggerKeywords || [],
    content,
    updatedAt: new Date().toISOString(),
  });
}

function updateSkillModalSubmitState() {
  const submitButton = document.querySelector('[data-action="save-skill-modal"]');
  if (!submitButton) return;
  const fields = [
    document.querySelector('#skill-modal-name')?.value.trim(),
    document.querySelector('#skill-modal-description')?.value.trim(),
    document.querySelector('#skill-modal-instructions')?.value.trim(),
  ];
  submitButton.disabled = fields.some((value) => !value);
}

function stripWrappingQuotes(value = '') {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2');
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { attributes: {}, body: source };

  const attributes = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const property = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!property) return;
    attributes[property[1].toLowerCase()] = stripWrappingQuotes(property[2]);
  });
  return { attributes, body: source.slice(match[0].length) };
}

function extractMarkdownSection(source, heading) {
  const pattern = new RegExp(`(?:^|\\n)##\\s+${heading}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+|$)`, 'i');
  return source.match(pattern)?.[1]?.trim() || '';
}

function parseTriggerKeywords(value = '') {
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((keyword) => stripWrappingQuotes(keyword))
    .filter((keyword) => keyword && keyword !== '-');
}

function parseUploadedSkill(fileName, source) {
  const normalized = source.replace(/^\uFEFF/, '').trim();
  const { attributes, body } = parseFrontmatter(normalized);
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fallbackName = fileName.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim();
  const description = attributes.description || extractMarkdownSection(body, 'Description');
  const instructions = extractMarkdownSection(body, 'Instructions')
    || body
      .replace(/^#\s+.+\r?\n?/, '')
      .replace(/^Active:\s*.+$/gim, '')
      .replace(/^Trigger keywords:\s*.+$/gim, '')
      .trim();
  const triggerLine = body.match(/^Trigger keywords:\s*(.+)$/im)?.[1] || '';
  const triggerKeywords = parseTriggerKeywords(
    attributes.trigger_keywords || attributes.triggers || triggerLine,
  );

  return {
    id: `custom-${Date.now()}`,
    name: attributes.name || title || fallbackName || 'Imported skill',
    active: !/^no|false$/i.test(attributes.active || body.match(/^Active:\s*(.+)$/im)?.[1] || ''),
    builtin: false,
    description: description || 'Skill imported from a local file.',
    triggerKeywords,
    content: instructions || normalized || 'Add skill instructions here.',
  };
}

async function importSkillFile(file) {
  if (!file) return;
  if (!/\.md$/i.test(file.name)) {
    setState({ skillFileError: 'Skill harus diunggah sebagai file Markdown (.md).' }, false);
    return;
  }
  const content = await file.text();
  state.skillFileError = '';
  upsertSkill(parseUploadedSkill(file.name, content));
}

async function replaceSelectedSkillFile(file) {
  const skill = selectedSkill();
  if (!skill || !file) return;
  if (!/\.md$/i.test(file.name)) {
    setState({ skillFileError: 'Skill pengganti harus berupa file Markdown (.md).' }, false);
    return;
  }
  const content = await file.text();
  const replacement = parseUploadedSkill(file.name, content);
  state.skillFileError = '';
  upsertSkill({
    ...replacement,
    id: skill.id,
    builtin: skill.builtin,
    active: skill.active,
  });
}

function uninstallSelectedSkill() {
  const skill = selectedSkill();
  if (!skill) return;
  const remaining = activeSkills().filter((item) => item.id !== skill.id);
  setState({
    skills: (state.skills || []).filter((item) => item.id !== skill.id),
    uninstalledSkillIds: [...new Set([...(state.uninstalledSkillIds || []), skill.id])],
    activeSkill: remaining[0]?.id || null,
  });
}

function useSelectedSkillInChat(edit = false) {
  const skill = selectedSkill();
  if (!skill) return;
  const prompt = edit
    ? `Help me improve the "${skill.name}" skill instructions:\n\n${skill.content}`
    : `Use the "${skill.name}" skill for this request:`;
  focusPrompt(prompt);
}

function icon(name, className = '') {
  return `<span class="material-symbols-outlined ${className}" aria-hidden="true">${name}</span>`;
}

function phIcon(name, className = '') {
  return `<i class="ph ph-${name} ${className}" aria-hidden="true"></i>`;
}

function formatMemoryTime(value) {
  if (!value) return 'Belum pernah';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function saveSettings() {
  state.profile = {
    fullName: document.querySelector('#profile-full-name')?.value.trim() || state.profile.fullName,
    callName: document.querySelector('#profile-call-name')?.value.trim() || state.profile.callName,
    work: document.querySelector('#profile-work')?.value || '',
  };
  saveState();
  render();
}

function projectMemoryMarkdown() {
  const project = activeMemory();
  if (!project) return '';
  return `# Project memory: ${project.name}\n\n${generatedProjectMemory(project.id) || project.memory || '-'}`;
}

function globalMemoryMarkdown() {
  return `# Global memory\n\n${state.globalMemory || '-'}`;
}

function memoryModalProject() {
  return projectById(state.activeProject) || projectById(currentConversation()?.projectId);
}

function memoryModalContent() {
  if (state.memoryModalScope === 'global') return state.globalMemory || '';
  const project = memoryModalProject();
  return project ? generatedProjectMemory(project.id) || project.memory || '' : '';
}

function openMemoryModal(scope) {
  state.memoryModalScope = scope;
  state.memoryModalEditing = false;
  saveState();
  render();
}

function closeMemoryModal() {
  state.memoryModalScope = null;
  state.memoryModalEditing = false;
  saveState();
  render();
}

function startMemoryModalEditing() {
  state.memoryModalEditing = true;
  render();
  document.querySelector('#memory-modal-editor')?.focus();
}

function saveMemoryModal() {
  const value = document.querySelector('#memory-modal-editor')?.value.trim() || '';
  const now = new Date().toISOString();
  if (state.memoryModalScope === 'global') {
    state.globalMemory = value;
    state.memoryUpdatedAt = { ...state.memoryUpdatedAt, global: now };
  } else {
    const project = memoryModalProject();
    if (!project) return;
    state.projectMemories = { ...state.projectMemories, [project.id]: value };
    state.memoryUpdatedAt = {
      ...state.memoryUpdatedAt,
      projects: { ...(state.memoryUpdatedAt?.projects || {}), [project.id]: now },
    };
  }
  state.memoryModalEditing = false;
  saveState();
  render();
}

function parseMemoryForDisplay(memory = '') {
  const text = String(memory || '').trim();
  if (!text) return [];
  const escapedHeadings = MEMORY_SECTION_TITLES.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const headingPattern = new RegExp(`^(?:#{1,3}\\s*)?(${escapedHeadings})\\s*$`, 'gim');
  const matches = [...text.matchAll(headingPattern)];
  if (!matches.length) return [{ heading: '', content: text }];
  return matches.map((match, index) => ({
    heading: match[1],
    content: text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length).trim(),
  })).filter((section) => section.content);
}

function renderMemoryDocument(memory) {
  const sections = parseMemoryForDisplay(memory);
  if (!sections.length) return '<p class="memory-empty">No memory yet.</p>';
  return sections.map((section) => {
    const paragraphs = section.content
      .split(/\n\s*\n/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
      .join('');
    return `<section>${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : ''}${paragraphs}</section>`;
  }).join('');
}

function activeNav() {
  if (state.view === 'projects' || state.view === 'project') return 'projects';
  if (state.view === 'customize') return 'customize';
  return 'chat';
}

function renderWindowBar() {
  return `
    <header class="window-bar">
      <div class="window-tools">
        <button data-action="toggle-sidebar" aria-label="Toggle sidebar">${phIcon('list')}</button>
        <button data-action="toggle-sidebar" aria-label="Panel">${phIcon('sidebar-simple')}</button>
        <button data-action="focus-search" aria-label="Search">${phIcon('magnifying-glass')}</button>
        <button data-action="show-chat" aria-label="Back">${phIcon('arrow-left')}</button>
        <button disabled aria-label="Forward">${phIcon('arrow-right')}</button>
      </div>
      <div class="window-tools window-controls">
        <button disabled aria-label="Minimize">${phIcon('minus')}</button>
        <button disabled aria-label="Restore">${phIcon('app-window')}</button>
        <button disabled aria-label="Close">${phIcon('x')}</button>
      </div>
    </header>
  `;
}

function renderSidebar() {
  const nav = activeNav();
  const recentItems = state.conversations.map((conversation) => `
    <button class="recent-link ${conversation.id === state.activeConversation && nav === 'chat' ? 'active' : ''}" data-conversation="${conversation.id}" title="${escapeHtml(conversation.title)}">
      ${escapeHtml(conversation.title)}
    </button>
  `).join('');

  return `
    <aside class="app-sidebar ${state.sidebarCollapsed ? 'collapsed' : ''}">
      <div class="product-tabs">
        <button class="product-tab ${nav === 'chat' ? 'active' : ''}" data-action="show-chat">${phIcon('chat-circle')}<span>Chat</span></button>
      </div>
      <div class="sidebar-primary">
        <button class="new-chat-button" data-action="new-chat">${phIcon('plus')}<span>New chat</span></button>
        <button class="sidebar-link ${nav === 'projects' ? 'active' : ''}" data-action="show-projects">${phIcon('folder-simple')}<span>Projects</span></button>
        <button class="sidebar-link ${nav === 'customize' ? 'active' : ''}" data-action="show-customize">${phIcon('sliders-horizontal')}<span>Customize</span></button>
      </div>
      <div class="recent-section" id="recent-list">
        <p>Recents</p>
        <div class="recent-list">${recentItems}</div>
      </div>
      <div class="sidebar-footer">
        <button class="profile-button" data-action="show-settings">
          <span class="profile-avatar">N</span>
          <span class="profile-copy"><strong>${escapeHtml(state.profile.callName)}</strong></span>
          ${phIcon('caret-down')}
        </button>
        <button class="sidebar-download" data-action="download-global-memory" aria-label="Download global memory">${phIcon('download-simple')}</button>
      </div>
    </aside>
  `;
}

function renderActions(message) {
  return (message.actions ?? []).map((action) => `
    <div class="organic-action">
      ${icon(action.type === 'tool' ? 'build' : 'description')}
      <div><strong>${escapeHtml(action.name)}</strong><small>${escapeHtml(action.detail)}</small></div>
    </div>
  `).join('');
}

function renderMessages() {
  return currentMessages().map((message) => `
    <article class="message ${escapeHtml(message.role)}">
      <div class="message-avatar">${message.role === 'assistant' ? '<img class="claude-mark message-mark" src="/src/assets/claude-spark-clay.svg" alt="" />' : 'N'}</div>
      <div class="message-body">
        ${message.triggerCommands?.length ? `<div class="message-trigger-list">${message.triggerCommands.map((command) => `<span>/${escapeHtml(command.command)}</span>`).join('')}</div>` : ''}
        <p>${escapeHtml(message.text)}</p>
        ${message.usage ? `<small class="usage">${escapeHtml(message.model || state.model)} · input ${message.usage.input_tokens ?? 0} · output ${message.usage.output_tokens ?? 0}</small>` : ''}
        ${renderActions(message)}
        ${message.role === 'assistant' && !state.isSending ? `<button class="branch-message" data-branch-message="${message.id}">${icon('fork_right')} Branch dari sini</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderPromptCommandChips() {
  return (state.promptCommands || []).map((command) => `
    <button class="prompt-command-chip" data-remove-prompt-command="${escapeHtml(command.key)}" aria-label="Remove ${escapeHtml(command.label)}">
      <span>/${escapeHtml(command.command)}</span>
      <small>${command.kind === 'skill' ? 'Skill' : 'Tool'}</small>
      ${phIcon('x')}
    </button>
  `).join('');
}

function renderComposer({ project = false } = {}) {
  const hasCommands = Boolean(state.promptCommands?.length);
  return `
    <div class="composer ${project ? 'project-composer' : ''} ${hasCommands ? 'has-prompt-commands' : ''}">
      <div class="slash-command-menu" id="slash-command-menu" role="listbox" aria-label="Skill and tool commands" hidden></div>
      ${hasCommands ? `<div class="prompt-command-chips">${renderPromptCommandChips()}</div>` : ''}
      <textarea id="prompt-input" placeholder="${project ? 'Type / for skills and tools' : 'How can I help you today? Type / for commands'}" ${state.isSending ? 'disabled' : ''}>${escapeHtml(state.promptDraft || '')}</textarea>
      <div class="composer-controls">
        <button class="icon-button" data-quick="Lampirkan konteks berikut:" aria-label="Add">${phIcon('plus')}</button>
        <div class="composer-options">
          <select id="model-select" aria-label="Pilih model">
            ${defaultModels.map((model) => `<option value="${model.id}" ${model.id === currentModelId() ? 'selected' : ''}>${escapeHtml(model.label)}</option>`).join('')}
          </select>
          <select id="tone-select" aria-label="Pilih intensitas berpikir">
            ${['Rendah', 'Sedang', 'Tinggi'].map((tone) => `<option ${tone === state.tone ? 'selected' : ''}>${tone}</option>`).join('')}
          </select>
          <button class="icon-button" data-quick="Transkrip voice saya:" aria-label="Voice">${phIcon('microphone')}</button>
          <button class="send-button ${project ? 'project-send' : 'chat-send'}" data-action="send-message" aria-label="Send" ${state.isSending ? 'disabled' : ''}>${state.isSending ? phIcon('stop') : project ? phIcon('paper-plane-right') : phIcon('chart-bar')}</button>
        </div>
      </div>
    </div>
  `;
}

function renderChatView() {
  const hasUserMessage = currentMessages().some((message) => message.role === 'user');
  const callName = state.profile.callName || 'nafis';
  return `
    <main class="chat-view">
      <div class="chat-window-controls">
        <button aria-label="Feedback">${phIcon('smiley')}</button>
        <button disabled aria-label="Minimize">${phIcon('minus')}</button>
        <button disabled aria-label="Restore">${phIcon('app-window')}</button>
        <button disabled aria-label="Close">${phIcon('x')}</button>
      </div>
      <section class="chat-content ${hasUserMessage ? 'conversation-mode' : 'empty-mode'}">
        ${hasUserMessage ? `
          <div class="conversation-header">
            <h1>${escapeHtml(currentConversation()?.title || 'Chat')}</h1>
            <button data-action="branch-chat" class="secondary-button">${icon('fork_right')} Branch</button>
          </div>
          <div class="messages" id="messages">${renderMessages()}${state.isSending ? '<div class="typing">Claude sedang berpikir…</div>' : ''}</div>
        ` : `
          <div class="greeting">
            <img class="claude-mark greeting-mark" src="/src/assets/claude-spark-clay.svg" alt="Claude" />
            <h1>Good evening, ${escapeHtml(callName)}</h1>
          </div>
        `}
        ${state.error ? `<div class="error-banner">${escapeHtml(state.error)}</div>` : ''}
        ${renderComposer()}
        ${hasUserMessage ? '' : `
          <div class="suggestion-chips">
            <button data-quick="Susun strategi untuk:">${icon('monitoring')}<span>Strategize</span></button>
            <button data-quick="Tulis kode untuk:">${icon('code')}<span>Code</span></button>
            <button data-quick="Ajari saya tentang:">${icon('school')}<span>Learn</span></button>
            <button data-quick="Bantu saya menulis:">${icon('edit')}<span>Write</span></button>
          </div>
        `}
      </section>
    </main>
  `;
}

function renderProjectsView() {
  const cards = allProjects().map((project) => {
    const count = state.conversations.filter((conversation) => conversation.projectId === project.id).length;
    return `
      <button class="project-card" data-open-project="${project.id}" data-project-name="${escapeHtml(project.name.toLowerCase())}">
        <span>
          <strong>${escapeHtml(project.name)}</strong>
          <p>${escapeHtml(project.memory || 'Project workspace with dedicated memory and instructions.')}</p>
        </span>
        <small>${count} chat${count === 1 ? '' : 's'} · Updated recently</small>
      </button>
    `;
  }).join('');
  return `
    <main class="page-view projects-view">
      <div class="page-heading">
        <h1>Projects</h1>
        <div class="page-actions">
          <button class="sort-button">Sort by <strong>Recent activity</strong>${icon('expand_more')}</button>
          <button class="primary-dark" data-action="new-project">New project</button>
        </div>
      </div>
      <label class="search-field">
        ${icon('search')}
        <input id="project-search" placeholder="Search projects..." />
      </label>
      <div class="project-grid">${cards}</div>
    </main>
  `;
}

function renderProjectMemoryPanel(project) {
  const memory = generatedProjectMemory(project.id) || project.memory || '';
  return `
    <section class="context-card memory-context" data-action="open-project-memory">
      <div class="context-card-heading">
        <h2>Memory</h2>
        <span class="privacy-chip">${icon('lock')} Only you</span>
        <button class="icon-button" data-action="open-project-memory" aria-label="Manage project memory">${icon('edit')}</button>
      </div>
      <p>${escapeHtml(memory || 'No project memory yet.')}</p>
      <small>Last updated ${escapeHtml(formatMemoryTime(state.memoryUpdatedAt?.projects?.[project.id]))}</small>
    </section>
  `;
}

function renderProjectDetailView() {
  const project = projectById(state.activeProject) || allProjects()[0];
  if (!project) return renderProjectsView();
  const projectConversations = state.conversations.filter((conversation) => conversation.projectId === project.id);
  const history = projectConversations.length
    ? projectConversations.map((conversation) => `
        <button class="project-history-item" data-conversation="${conversation.id}">
          <strong>${escapeHtml(conversation.title)}</strong>
          <small>Last message ${escapeHtml(conversation.updated)}</small>
        </button>
      `).join('')
    : '<p class="empty-copy">Belum ada chat di proyek ini.</p>';
  const instruction = projectInstruction(project);
  const files = projectFiles(project.id).map((file) => `
    <article class="project-file ${file.included === false ? '' : 'in-context'}">
      <div class="project-file-heading">
        <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
        <button data-project-file-delete="${file.id}" aria-label="Delete ${escapeHtml(file.name)}">${phIcon('trash')}</button>
      </div>
      <div class="project-file-meta">
        <small>${file.content.split('\n').length} lines · ${formatFileSize(file.size)}</small>
        <b>${escapeHtml(projectFileExtension(file.name).toUpperCase() || 'FILE')}</b>
      </div>
      <button class="project-file-context-toggle" data-project-file-toggle="${file.id}" aria-pressed="${file.included !== false}">
        ${phIcon(file.included === false ? 'circle' : 'check-circle')}
        <span>${file.included === false ? 'Add to context' : 'In context'}</span>
      </button>
    </article>
  `).join('');
  return `
    <main class="project-detail-view">
      <button class="back-link" data-action="show-projects">${icon('arrow_back')} All projects</button>
      <div class="project-detail-layout">
        <section class="project-primary">
          <div class="project-title-row">
            <h1>${escapeHtml(project.name)}</h1>
            <span><button class="icon-button">${icon('more_vert')}</button><button class="icon-button">${icon('push_pin')}</button></span>
          </div>
          ${renderComposer({ project: true })}
          <div class="project-history">${history}</div>
        </section>
        <aside class="project-context-column">
          ${renderProjectMemoryPanel(combineProjectMemory(project))}
          <section class="context-card">
            <div class="context-card-heading"><h2>Instructions</h2><button class="icon-button" data-action="open-project-instructions" aria-label="Edit project instructions">${icon('add')}</button></div>
            <p class="italic">${escapeHtml(instruction || 'Add instructions to tailor Claude’s responses')}</p>
          </section>
          <section class="context-card files-context">
            <div class="context-card-heading"><h2>Files</h2><button class="icon-button" data-action="upload-project-files" aria-label="Upload project files">${icon('add')}</button></div>
            ${state.projectFileError ? `<div class="project-file-error">${phIcon('warning-circle')}<span>${escapeHtml(state.projectFileError)}</span></div>` : ''}
            <div class="project-files">${files || '<p class="empty-copy">No files yet.</p>'}</div>
            <input class="project-file-upload-input" type="file" multiple accept=".md,.txt,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css,.xml,.yaml,.yml,text/*,application/json" aria-label="Upload project context files" />
          </section>
        </aside>
      </div>
    </main>
  `;
}

function formatConnectorCheckTime(value) {
  if (!value) return 'Belum diuji';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function renderConnectorProduct({ iconName, name, description, capabilities }) {
  const connected = state.connectorStatus.connected;
  return `
    <article class="connector-product-card">
      <div class="connector-product-icon ${name.toLowerCase()}">${phIcon(iconName)}</div>
      <div class="connector-product-copy">
        <div class="connector-product-heading">
          <h3>${name}</h3>
          <span class="connector-product-status ${connected ? 'connected' : ''}">
            <i></i>${connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p>${description}</p>
        <div class="connector-capabilities">
          ${capabilities.map((capability) => `<span>${phIcon('check')}${capability}</span>`).join('')}
        </div>
      </div>
    </article>
  `;
}

function renderConnectorsPanel() {
  const connector = state.connectorStatus;
  const busy = state.connectorBusy;
  return `
    <section class="connectors-panel">
      <div class="connectors-heading">
        <div>
          <p class="connectors-eyebrow">Workspace tools</p>
          <h2>Connectors</h2>
          <p>Hubungkan Atlassian agar chat dapat mencari, membaca, dan memperbarui Jira serta Confluence.</p>
        </div>
        <span class="connector-overall-status ${connector.connected ? 'connected' : ''}">
          <i></i>${connector.loading ? 'Checking...' : connector.connected ? 'Atlassian connected' : 'Not connected'}
        </span>
      </div>

      <section class="atlassian-connection-card ${connector.connected ? 'connected' : ''}">
        <div class="atlassian-connection-header">
          <div class="atlassian-mark">${phIcon('circles-three-plus')}</div>
          <div>
            <h3>Atlassian</h3>
            <p>Satu koneksi aman untuk Jira dan Confluence Cloud.</p>
          </div>
        </div>

        ${connector.connected ? `
          <div class="connector-account-summary">
            <div>
              <span>Account</span>
              <strong>${escapeHtml(connector.displayName || 'Atlassian account')}</strong>
              <small>${escapeHtml(connector.email)}</small>
            </div>
            <div>
              <span>Site</span>
              <strong>${escapeHtml(connector.baseUrl.replace(/^https?:\/\//, ''))}</strong>
              <small>${connector.source === 'environment' ? 'Configured by server environment' : 'Connected for this server session'}</small>
            </div>
            <div>
              <span>Last checked</span>
              <strong>${escapeHtml(formatConnectorCheckTime(connector.checkedAt))}</strong>
              <small>Jira and Confluence access</small>
            </div>
          </div>
          <div class="connector-card-actions">
            <button data-action="test-atlassian" ${busy ? 'disabled' : ''}>
              ${busy === 'test' ? phIcon('spinner-gap', 'spin') : phIcon('pulse')} Test connection
            </button>
            <button class="danger-quiet" data-action="disconnect-atlassian" ${busy ? 'disabled' : ''}>
              ${busy === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ` : `
          <div class="connector-form">
            <label>
              <span>Atlassian site URL</span>
              <input id="atlassian-base-url" type="url" placeholder="https://your-company.atlassian.net" autocomplete="url" />
            </label>
            <label>
              <span>Email</span>
              <input id="atlassian-email" type="email" placeholder="you@company.com" autocomplete="email" />
            </label>
            <label>
              <span>API token</span>
              <input id="atlassian-api-token" type="password" placeholder="Paste your Atlassian API token" autocomplete="off" />
            </label>
            <div class="connector-form-footer">
              <p>${phIcon('shield-check')} Token hanya disimpan di memori proses server dan tidak masuk ke browser storage.</p>
              <button class="primary-dark" data-action="connect-atlassian" ${busy || connector.loading ? 'disabled' : ''}>
                ${busy === 'connect' ? `${phIcon('spinner-gap', 'spin')} Connecting...` : 'Connect Atlassian'}
              </button>
            </div>
          </div>
        `}

        ${connector.error ? `<div class="connector-error">${phIcon('warning-circle')}<span>${escapeHtml(connector.error)}</span></div>` : ''}
      </section>

      <div class="connector-products-heading">
        <h3>Available tools</h3>
        <p>Kedua tool memakai akun Atlassian yang sama.</p>
      </div>
      <div class="connector-products">
        ${renderConnectorProduct({
          iconName: 'check-square-offset',
          name: 'Jira',
          description: 'Cari issue, baca detail ticket, buat issue baru, ubah field, dan tambahkan komentar.',
          capabilities: ['Search & read', 'Create & update', 'Add comments'],
        })}
        ${renderConnectorProduct({
          iconName: 'files',
          name: 'Confluence',
          description: 'Cari halaman, baca isi workspace, dan perbarui halaman dengan instruksi eksplisit.',
          capabilities: ['Search pages', 'Read content', 'Update pages'],
        })}
      </div>
    </section>
  `;
}

function renderCustomizeView() {
  const showConnectors = state.customizeSection === 'connectors';
  const skills = activeSkills();
  const skill = selectedSkill();
  const skillRows = skills.map((item) => `
    <button class="skill-list-item ${item.id === skill?.id ? 'active' : ''}" data-skill-select="${item.id}">
      ${escapeHtml(item.name)}
    </button>
  `).join('');
  const skillCreateControl = (placement, label) => `
    <details class="skill-create-disclosure ${placement}">
      <summary aria-label="${label}">${phIcon('plus')}</summary>
      <div class="skill-create-menu" role="menu" aria-label="Skill creation options">
        <button role="menuitem" data-action="write-skill-instructions">
          ${phIcon('notepad')}<span>Write skill instructions</span>
        </button>
        <button role="menuitem" data-action="upload-skill">
          ${phIcon('upload-simple')}<span>Upload a skill</span>
        </button>
      </div>
    </details>
  `;
  return `
    <main class="customize-view">
      <header class="customize-header"><button data-action="show-chat">${phIcon('arrow-left')}</button><h1>Customize</h1><span class="profile-avatar">N</span></header>
      <div class="customize-layout ${showConnectors ? 'connectors-mode' : ''}">
        <aside class="customize-nav">
          <button class="${showConnectors ? '' : 'active'}" data-action="show-customize-skills">${phIcon('books')}<span>Skills</span></button>
          <button class="${showConnectors ? 'active' : ''}" data-action="show-customize-connectors">${phIcon('plugs-connected')}<span>Connectors</span></button>
        </aside>
        ${showConnectors ? renderConnectorsPanel() : `
          <section class="skill-browser">
            <div class="skill-browser-heading"><h2>Skills</h2><span><button aria-label="Search skills">${phIcon('magnifying-glass')}</button>${skillCreateControl('from-browser', 'Create skill')}</span></div>
            <p class="skill-group-label">${phIcon('caret-down')} Personal skills</p>
            <div class="skill-list">${skillRows}</div>
          </section>
          <section class="skill-detail">
            ${skill ? `
              <div class="skill-title-row">
                <h2>${escapeHtml(skill.name)}</h2>
                <span class="skill-title-actions">
                  <label class="toggle"><input type="checkbox" data-skill="${skill.id}" ${skill.active ? 'checked' : ''} /><span></span></label>
                  <details class="skill-actions-disclosure">
                    <summary aria-label="Skill actions">${phIcon('dots-three-vertical')}</summary>
                    <div class="skill-actions-menu" role="menu" aria-label="Skill actions">
                      <button role="menuitem" data-action="try-skill-in-chat">${phIcon('chat-circle-dots')}<span>Try in chat</span></button>
                      <button role="menuitem" data-action="edit-skill">${phIcon('pencil-simple')}<span>Edit</span></button>
                      <button role="menuitem" data-action="edit-skill-with-claude">${phIcon('chats-circle')}<span>Edit with Claude</span></button>
                      <button role="menuitem" data-action="replace-skill">${phIcon('upload-simple')}<span>Replace</span></button>
                      <button role="menuitem" data-action="download-skill">${phIcon('download-simple')}<span>Download</span></button>
                      <div class="skill-actions-separator"></div>
                      <button class="danger" role="menuitem" data-action="uninstall-skill">${phIcon('trash')}<span>Uninstall</span></button>
                    </div>
                  </details>
                </span>
              </div>
              <dl class="skill-meta">
                <div><dt>Added by</dt><dd>You</dd></div>
                <div><dt>Last updated</dt><dd>June 12, 2026</dd></div>
                <div><dt>Trigger</dt><dd>${escapeHtml((skill.triggerKeywords || []).join(', ') || 'Auto')}</dd></div>
              </dl>
              <div class="skill-description">
                <span>Description ${phIcon('info')}</span>
                <p>${escapeHtml(skill.description || 'No description yet.')}</p>
              </div>
              ${state.skillFileError ? `<div class="skill-file-error">${phIcon('warning-circle')}<span>${escapeHtml(state.skillFileError)}</span></div>` : ''}
              <article class="skill-document">
                <div class="skill-document-tools" role="group" aria-label="Skill Markdown view">
                  <button class="${state.skillViewMode === 'preview' ? 'active' : ''}" data-action="show-skill-preview" aria-label="Preview rendered Markdown" aria-pressed="${state.skillViewMode === 'preview'}">${phIcon('eye')}</button>
                  <button class="${state.skillViewMode === 'raw' ? 'active' : ''}" data-action="show-skill-raw" aria-label="View raw Markdown" aria-pressed="${state.skillViewMode === 'raw'}">${phIcon('code')}</button>
                </div>
                ${state.skillViewMode === 'raw'
                  ? `<pre class="skill-document-raw"><code>${escapeHtml(skillAsMarkdown(skill))}</code></pre>`
                  : `<div class="skill-markdown-preview">${renderMarkdown(skillMarkdownBody(skill))}</div>`}
              </article>
            ` : ''}
          </section>
        `}
      </div>
      <input class="skill-upload-input" type="file" accept=".md,text/markdown" aria-label="Upload a Markdown skill file" />
      <input class="skill-replace-input" type="file" accept=".md,text/markdown" aria-label="Replace selected skill with a Markdown file" />
    </main>
  `;
}

function renderSkillModal() {
  if (!state.skillModalMode) return '';
  const isEdit = state.skillModalMode === 'edit';
  const skill = isEdit ? selectedSkill() : null;
  const title = isEdit ? 'Edit skill instructions' : 'Write skill instructions';
  return `
    <div class="skill-modal-backdrop">
      <section class="skill-modal" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="skill-modal-header">
          <h2>${title}</h2>
          <button data-action="close-skill-modal" aria-label="Close skill editor">${phIcon('x')}</button>
        </header>
        <div class="skill-modal-fields">
          <label>
            <span>Skill name</span>
            <input id="skill-modal-name" value="${escapeHtml(skill?.name || '')}" placeholder="weekly-status-report" />
          </label>
          <label>
            <span>Description</span>
            <textarea id="skill-modal-description" placeholder="Generate weekly status reports from recent work. Use when asked for updates or progress summaries.">${escapeHtml(skill?.description || '')}</textarea>
          </label>
          <label>
            <span>Instructions</span>
            <textarea id="skill-modal-instructions" placeholder="Summarize my recent work in three sections: wins, blockers, and next steps. Keep the tone professional but not stiff...">${escapeHtml(skill?.content || '')}</textarea>
          </label>
        </div>
        <footer class="skill-modal-actions">
          <button data-action="close-skill-modal">Cancel</button>
          <button class="skill-modal-submit" data-action="save-skill-modal" ${skill ? '' : 'disabled'}>${isEdit ? 'Save' : 'Create'}</button>
        </footer>
      </section>
    </div>
  `;
}

function renderProjectInstructionModal() {
  if (!state.projectInstructionModalOpen) return '';
  const project = projectById(state.activeProject);
  if (!project) return '';
  return `
    <div class="project-instruction-backdrop">
      <section class="project-instruction-modal" role="dialog" aria-modal="true" aria-label="Project instructions">
        <header>
          <div>
            <h2>Project instructions</h2>
            <p>Instruksi ini selalu diterapkan pada chat di project ${escapeHtml(project.name)}.</p>
          </div>
          <button data-action="close-project-instructions" aria-label="Close project instructions">${phIcon('x')}</button>
        </header>
        <label>
          <span>Instructions</span>
          <textarea id="project-instruction-editor" placeholder="Contoh: Gunakan Bahasa Indonesia, fokus pada edtech B2B, target sekolah dan bootcamp.">${escapeHtml(projectInstruction(project))}</textarea>
        </label>
        <footer>
          <button data-action="close-project-instructions">Cancel</button>
          <button class="primary-dark" data-action="save-project-instructions">Save</button>
        </footer>
      </section>
    </div>
  `;
}

function renderArtifactsView() {
  const activeArtifact = state.artifacts.find((artifact) => artifact.id === state.activeArtifact) || state.artifacts[0];
  const rows = state.artifacts.map((artifact) => `
    <button class="artifact-list-item ${artifact.id === activeArtifact?.id ? 'active' : ''}" data-artifact="${artifact.id}">
      ${icon('description')}<span><strong>${escapeHtml(artifact.name)}</strong><small>${escapeHtml(artifact.detail)}</small></span>
    </button>
  `).join('');
  return `
    <main class="artifacts-view">
      <header class="customize-header"><button data-action="show-chat">${phIcon('arrow-left')}</button><h1>Artifacts</h1><span class="profile-avatar">N</span></header>
      <div class="artifact-layout">
        <section class="artifact-list"><div class="artifact-list-heading"><h2>Files</h2>${phIcon('magnifying-glass')}</div>${rows}</section>
        <section class="artifact-detail">
          ${activeArtifact ? `
            <div class="artifact-detail-heading">
              <h2>${escapeHtml(activeArtifact.name)}</h2>
              <span><button data-copy="${activeArtifact.id}">Copy</button><button data-download="${activeArtifact.id}" class="primary-dark">Download</button></span>
            </div>
            <pre>${escapeHtml(activeArtifact.content)}</pre>
          ` : '<p class="empty-copy">No artifacts yet.</p>'}
        </section>
      </div>
    </main>
  `;
}

function renderSettingsContent() {
  if (state.settingsSection !== 'general') {
    const labels = {
      account: 'Account',
      privacy: 'Privacy',
      billing: 'Billing',
      capabilities: 'Capabilities',
      connectors: 'Connectors',
      code: 'Claude Code',
      desktop: 'Desktop app',
      extensions: 'Extensions',
      developer: 'Developer',
    };
    return `
      <section class="settings-placeholder">
        <h2>${labels[state.settingsSection] || 'Settings'}</h2>
        <p>Pengaturan ini belum memerlukan konfigurasi tambahan pada workspace lokal.</p>
      </section>
    `;
  }
  return `
    <section class="settings-content">
      <h2>Profile</h2>
      <div class="settings-row"><label>Avatar</label><span class="large-avatar">N</span></div>
      <div class="settings-row"><label for="profile-full-name">Full name</label><input id="profile-full-name" value="${escapeHtml(state.profile.fullName)}" /></div>
      <div class="settings-row"><label for="profile-call-name">What should Claude call you?</label><input id="profile-call-name" value="${escapeHtml(state.profile.callName)}" /></div>
      <div class="settings-row"><label for="profile-work">What best describes your work?</label><select id="profile-work"><option value="">Select</option><option ${state.profile.work === 'Research' ? 'selected' : ''}>Research</option><option ${state.profile.work === 'Engineering' ? 'selected' : ''}>Engineering</option><option ${state.profile.work === 'Founder' ? 'selected' : ''}>Founder</option></select></div>
      <div class="settings-section-block">
        <h3>API key</h3>
        <p>Dipakai oleh proxy lokal untuk mengakses Claude API.</p>
        <input id="api-key-input" type="password" placeholder="sk-ant-..." value="${escapeHtml(state.apiKey)}" />
        <label class="check-row"><input type="checkbox" id="save-key" ${state.apiKeySaved ? 'checked' : ''} /> Simpan di browser ini</label>
      </div>
      <div class="settings-section-block">
        <h3>Global memory</h3>
        <p>Preferensi lintas sesi. Memori ini tidak ditampilkan di halaman proyek.</p>
        <button class="global-memory-card" data-action="open-global-memory">
          <span><strong>Manage global memory</strong><small>${escapeHtml(state.globalMemory || 'No global memory yet.')}</small></span>
          <span><small>Last updated: ${escapeHtml(formatMemoryTime(state.memoryUpdatedAt?.global))}</small>${icon('arrow_forward')}</span>
        </button>
      </div>
      <div class="settings-save-row">
        <button data-action="save-settings" class="primary-dark">Save changes</button>
        <button data-action="copy-global-memory">Copy memory</button>
        <button data-action="download-global-memory">Download</button>
      </div>
    </section>
  `;
}

function renderSettingsModal() {
  if (!state.settingsOpen) return '';
  const items = [
    ['general', 'settings', 'General'],
    ['account', 'person', 'Account'],
    ['privacy', 'shield', 'Privacy'],
    ['billing', 'credit_card', 'Billing'],
    ['capabilities', 'work', 'Capabilities'],
    ['connectors', 'cable', 'Connectors'],
    ['code', 'code', 'Claude Code'],
  ];
  return `
    <div class="settings-backdrop">
      <div class="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <aside class="settings-nav">
          <label class="settings-search">${icon('search')}<input placeholder="Search" /></label>
          <p>Settings</p>
          ${items.map(([id, iconName, label]) => `<button class="${state.settingsSection === id ? 'active' : ''}" data-settings-section="${id}">${icon(iconName)}<span>${label}</span></button>`).join('')}
        </aside>
        <div class="settings-main">
          <button class="settings-close" data-action="close-settings" aria-label="Close">${icon('close')}</button>
          ${renderSettingsContent()}
        </div>
      </div>
    </div>
  `;
}

function renderMemoryModal() {
  if (!state.memoryModalScope) return '';
  const project = memoryModalProject();
  const isGlobal = state.memoryModalScope === 'global';
  const title = isGlobal ? 'Manage global memory' : 'Manage project memory';
  const description = isGlobal
    ? 'Claude regenerates global memory from your past chats. It keeps durable preferences and context that can be used across projects.'
    : `Claude regenerates project memory every evening from your past chats in this project. Only you can see this memory, and it is not shared with other project users.`;
  const memory = memoryModalContent();
  return `
    <div class="memory-modal-backdrop">
      <section class="memory-modal" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="memory-modal-header">
          <h2>${title}</h2>
          <button data-action="close-memory-modal" aria-label="Close memory">${icon('close')}</button>
        </header>
        <p class="memory-modal-description">${description}</p>
        <div class="memory-document-frame ${state.memoryModalEditing ? 'editing' : ''}">
          ${state.memoryModalEditing
            ? `<textarea id="memory-modal-editor" aria-label="${isGlobal ? 'Global memory editor' : 'Project memory editor'}">${escapeHtml(memory)}</textarea>`
            : `<article class="memory-document">${renderMemoryDocument(memory)}</article>`}
          ${state.memoryModalEditing ? '' : `<button class="memory-edit-fab" data-action="edit-memory-modal" aria-label="Edit ${isGlobal ? 'global' : 'project'} memory">${phIcon('pencil-simple')}</button>`}
        </div>
        ${state.memoryModalEditing ? `
          <footer class="memory-modal-actions">
            <button data-action="cancel-memory-modal-edit">Cancel</button>
            <button data-action="save-memory-modal" class="primary-dark">Save</button>
          </footer>
        ` : ''}
        ${!isGlobal && project ? `<span class="memory-modal-project-name">${escapeHtml(project.name)}</span>` : ''}
      </section>
    </div>
  `;
}

function focusPrompt(prefix = '') {
  const input = document.querySelector('#prompt-input');
  if (!input) {
    state.view = 'chat';
    saveState();
    render();
  }
  const nextInput = document.querySelector('#prompt-input');
  nextInput?.focus();
  if (prefix && nextInput) {
    nextInput.value = `${prefix} ${nextInput.value}`.trim();
    state.promptDraft = nextInput.value;
  }
}

function openProjectDetail(projectId) {
  state.activeProject = projectId;
  state.view = 'project';
  state.projectMemoryEditing = false;
  state.projectFileError = '';
  saveState();
  render();
}

function createProjectConversation(projectId) {
  const id = nextConversationId();
  const project = projectById(projectId);
  state.conversations = [{
    id,
    title: 'Tanpa judul',
    projectId,
    model: currentModelId(),
    preview: 'Sesi proyek baru',
    updated: 'Baru saja',
  }, ...state.conversations];
  state.messagesByConversation = {
    ...state.messagesByConversation,
    [id]: [{ ...welcomeMessage, id: crypto.randomUUID(), text: `Project ${project?.name || ''} aktif.` }],
  };
  state.activeConversation = id;
}

function sendMessageFromCurrentView() {
  const input = document.querySelector('#prompt-input');
  const prompt = input?.value.trim() || state.promptDraft.trim() || '';
  if (!prompt) return;
  state.promptDraft = prompt;
  if (state.view === 'project' && currentConversation()?.projectId !== state.activeProject) {
    createProjectConversation(state.activeProject);
    saveState();
    render();
  }
  addMessage();
}

let slashMenuState = { open: false, options: [], activeIndex: 0, range: null };

function closeSlashCommandMenu() {
  const menu = document.querySelector('#slash-command-menu');
  if (menu) menu.hidden = true;
  slashMenuState = { open: false, options: [], activeIndex: 0, range: null };
}

function slashCommandContext(input) {
  const cursor = input.selectionStart ?? input.value.length;
  const beforeCursor = input.value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  if (!match) return null;
  return {
    query: match[1].toLowerCase(),
    start: cursor - match[1].length - 1,
    end: cursor,
  };
}

function renderSlashCommandMenu() {
  const menu = document.querySelector('#slash-command-menu');
  if (!menu || !slashMenuState.open) return;
  const groups = [
    { kind: 'skill', label: 'Skills', icon: 'books' },
    { kind: 'tool', label: 'Atlassian tools', icon: 'plugs-connected' },
  ];
  menu.innerHTML = groups.map((group) => {
    const options = slashMenuState.options.filter((option) => option.kind === group.kind);
    if (!options.length) return '';
    return `
      <section class="slash-command-group">
        <p>${escapeHtml(group.label)}</p>
        ${options.map((option) => {
          const index = slashMenuState.options.indexOf(option);
          return `
            <button class="slash-command-option ${index === slashMenuState.activeIndex ? 'active' : ''}" data-prompt-command="${escapeHtml(option.key)}" role="option" aria-selected="${index === slashMenuState.activeIndex}">
              <span class="slash-command-icon">${phIcon(group.icon)}</span>
              <span class="slash-command-copy">
                <strong>/${escapeHtml(option.command)} <em>${escapeHtml(option.label)}</em></strong>
                <small>${escapeHtml(option.description)}</small>
              </span>
            </button>
          `;
        }).join('')}
      </section>
    `;
  }).join('');
  menu.hidden = false;
}

function updateSlashCommandMenu(input, resetIndex = true) {
  const context = slashCommandContext(input);
  if (!context) {
    closeSlashCommandMenu();
    return;
  }
  const options = promptCommandOptions().filter((option) => {
    const haystack = `${option.command} ${option.label} ${option.description}`.toLowerCase();
    return !context.query || haystack.includes(context.query);
  });
  if (!options.length) {
    closeSlashCommandMenu();
    return;
  }
  slashMenuState = {
    open: true,
    options,
    activeIndex: resetIndex ? 0 : Math.min(slashMenuState.activeIndex, options.length - 1),
    range: context,
  };
  renderSlashCommandMenu();
}

function selectPromptCommand(key) {
  const option = promptCommandOptions().find((command) => command.key === key);
  const input = document.querySelector('#prompt-input');
  if (!option || !input) return;
  const context = slashMenuState.range || slashCommandContext(input);
  const nextDraft = context
    ? `${input.value.slice(0, context.start)}${input.value.slice(context.end)}`.replace(/[ \t]{2,}/g, ' ')
    : input.value;
  const cursor = context?.start ?? nextDraft.length;
  state.promptDraft = nextDraft;
  if (!(state.promptCommands || []).some((command) => command.key === option.key)) {
    state.promptCommands = [...(state.promptCommands || []), option];
  }
  closeSlashCommandMenu();
  render();
  const nextInput = document.querySelector('#prompt-input');
  nextInput?.focus();
  nextInput?.setSelectionRange(cursor, cursor);
}

function removePromptCommand(key) {
  state.promptCommands = (state.promptCommands || []).filter((command) => command.key !== key);
  render();
  const input = document.querySelector('#prompt-input');
  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
}

function createNewProject() {
  const id = `project-${Date.now()}`;
  const project = {
    id,
    name: `New project ${state.customProjects.length + 1}`,
    systemPrompt: '',
    memory: '',
    color: 'neutral',
  };
  state.customProjects = [...state.customProjects, project];
  openProjectDetail(id);
}

function handleClick(event) {
  const promptCommandButton = event.target.closest('[data-prompt-command]');
  const removePromptCommandButton = event.target.closest('[data-remove-prompt-command]');
  if (promptCommandButton) return selectPromptCommand(promptCommandButton.dataset.promptCommand);
  if (removePromptCommandButton) return removePromptCommand(removePromptCommandButton.dataset.removePromptCommand);
  if (!event.target.closest('.composer')) closeSlashCommandMenu();

  const activeCreateMenu = event.target.closest('.skill-create-disclosure');
  document.querySelectorAll('.skill-create-disclosure[open]').forEach((menu) => {
    if (menu !== activeCreateMenu) menu.removeAttribute('open');
  });
  const activeSkillActions = event.target.closest('.skill-actions-disclosure');
  document.querySelectorAll('.skill-actions-disclosure[open]').forEach((menu) => {
    if (menu !== activeSkillActions) menu.removeAttribute('open');
  });

  const conversationButton = event.target.closest('[data-conversation]');
  const openProjectButton = event.target.closest('[data-open-project]');
  const quickButton = event.target.closest('[data-quick]');
  const actionButton = event.target.closest('[data-action]');
  const artifactButton = event.target.closest('[data-artifact]');
  const downloadButton = event.target.closest('[data-download]');
  const copyButton = event.target.closest('[data-copy]');
  const skillSelectButton = event.target.closest('[data-skill-select]');
  const settingsSectionButton = event.target.closest('[data-settings-section]');
  const branchMessageButton = event.target.closest('[data-branch-message]');
  const projectFileToggleButton = event.target.closest('[data-project-file-toggle]');
  const projectFileDeleteButton = event.target.closest('[data-project-file-delete]');

  if (projectFileDeleteButton) return removeProjectFile(projectFileDeleteButton.dataset.projectFileDelete);
  if (projectFileToggleButton) return toggleProjectFileContext(projectFileToggleButton.dataset.projectFileToggle);
  if (branchMessageButton) return branchConversation(branchMessageButton.dataset.branchMessage);
  if (conversationButton) {
    const activeConversation = Number(conversationButton.dataset.conversation);
    const conversation = conversationById(activeConversation);
    return setState({ activeConversation, activeProject: conversation?.projectId ?? null, view: 'chat' });
  }
  if (openProjectButton) return openProjectDetail(openProjectButton.dataset.openProject);
  if (quickButton) return focusPrompt(quickButton.dataset.quick);
  if (artifactButton) return setState({ activeArtifact: artifactButton.dataset.artifact, view: 'artifacts' });
  if (downloadButton) return downloadArtifact(downloadButton.dataset.download);
  if (copyButton) return copyArtifact(copyButton.dataset.copy);
  if (skillSelectButton) return setState({ activeSkill: skillSelectButton.dataset.skillSelect, skillViewMode: 'preview', skillFileError: '' });
  if (settingsSectionButton) return setState({ settingsSection: settingsSectionButton.dataset.settingsSection });
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  if (action === 'new-chat') newConversation();
  if (action === 'send-message') sendMessageFromCurrentView();
  if (action === 'branch-chat') branchConversation();
  if (action === 'show-chat') setState({ view: 'chat' });
  if (action === 'show-projects') setState({ view: 'projects' });
  if (action === 'show-artifacts') setState({ view: 'artifacts' });
  if (action === 'show-customize') setState({ view: 'customize' });
  if (action === 'show-customize-skills') setState({ customizeSection: 'skills' });
  if (action === 'show-customize-connectors') {
    setState({ customizeSection: 'connectors' });
    loadAtlassianConnectorStatus();
  }
  if (action === 'show-settings') setState({ settingsOpen: true, settingsSection: 'general' });
  if (action === 'close-settings') setState({ settingsOpen: false });
  if (action === 'open-project-memory') openMemoryModal('project');
  if (action === 'open-project-instructions') openProjectInstructionModal();
  if (action === 'close-project-instructions') closeProjectInstructionModal();
  if (action === 'save-project-instructions') saveProjectInstruction();
  if (action === 'upload-project-files') document.querySelector('.project-file-upload-input')?.click();
  if (action === 'open-global-memory') openMemoryModal('global');
  if (action === 'close-memory-modal') closeMemoryModal();
  if (action === 'edit-memory-modal') startMemoryModalEditing();
  if (action === 'cancel-memory-modal-edit') setState({ memoryModalEditing: false });
  if (action === 'save-memory-modal') saveMemoryModal();
  if (action === 'toggle-sidebar') setState({ sidebarCollapsed: !state.sidebarCollapsed });
  if (action === 'focus-search') document.querySelector('#project-search, .settings-search input')?.focus();
  if (action === 'new-project') createNewProject();
  if (action === 'copy-project-memory') copyText(projectMemoryMarkdown());
  if (action === 'save-settings') saveSettings();
  if (action === 'copy-global-memory') copyText(globalMemoryMarkdown());
  if (action === 'download-global-memory') downloadText('global-memory.md', globalMemoryMarkdown());
  if (action === 'write-skill-instructions') openSkillModal('create');
  if (action === 'upload-skill') document.querySelector('.skill-upload-input')?.click();
  if (action === 'close-skill-modal') closeSkillModal();
  if (action === 'save-skill-modal') saveSkillModal();
  if (action === 'try-skill-in-chat') useSelectedSkillInChat();
  if (action === 'edit-skill') openSkillModal('edit');
  if (action === 'edit-skill-with-claude') useSelectedSkillInChat(true);
  if (action === 'replace-skill') document.querySelector('.skill-replace-input')?.click();
  if (action === 'download-skill') downloadText(`${selectedSkill().name.toLowerCase().replaceAll(' ', '-')}.md`, skillAsMarkdown(selectedSkill()));
  if (action === 'uninstall-skill') uninstallSelectedSkill();
  if (action === 'show-skill-preview') setState({ skillViewMode: 'preview' });
  if (action === 'show-skill-raw') setState({ skillViewMode: 'raw' });
  if (action === 'connect-atlassian') connectAtlassian();
  if (action === 'test-atlassian') testAtlassianConnector();
  if (action === 'disconnect-atlassian') disconnectAtlassian();
}

function handleChange(event) {
  if (event.target.matches('.project-file-upload-input')) {
    importProjectFiles(event.target.files);
    event.target.value = '';
    return;
  }
  if (event.target.matches('.skill-upload-input')) {
    const [file] = event.target.files || [];
    importSkillFile(file);
    return;
  }
  if (event.target.matches('.skill-replace-input')) {
    const [file] = event.target.files || [];
    replaceSelectedSkillFile(file);
    return;
  }
  if (event.target.id === 'model-select') {
    state.conversations = state.conversations.map((conversation) => (
      conversation.id === state.activeConversation ? { ...conversation, model: event.target.value } : conversation
    ));
    setState({ model: event.target.value });
  }
  if (event.target.id === 'tone-select') setState({ tone: event.target.value });
  if (event.target.id === 'save-key') setState({ apiKeySaved: event.target.checked });
  if (event.target.dataset.skill) {
    const id = event.target.dataset.skill;
    setState({ skills: activeSkills().map((skill) => (skill.id === id ? { ...skill, active: event.target.checked } : skill)) });
  }
}

function handleInput(event) {
  if (event.target.id === 'prompt-input') {
    state.promptDraft = event.target.value;
    updateSlashCommandMenu(event.target);
  }
  if (event.target.closest('.skill-modal-fields')) updateSkillModalSubmitState();
  if (event.target.id === 'api-key-input') {
    state.apiKey = event.target.value.trim();
    if (state.apiKeySaved) saveState();
  }
  if (event.target.id === 'project-search') {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('[data-project-name]').forEach((card) => {
      card.hidden = query && !card.dataset.projectName.includes(query);
    });
  }
}

function handleKeydown(event) {
  if (event.target.id === 'prompt-input') {
    if (slashMenuState.open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      slashMenuState.activeIndex = (slashMenuState.activeIndex + direction + slashMenuState.options.length) % slashMenuState.options.length;
      renderSlashCommandMenu();
      return;
    }
    if (slashMenuState.open && ['Enter', 'Tab'].includes(event.key)) {
      event.preventDefault();
      selectPromptCommand(slashMenuState.options[slashMenuState.activeIndex]?.key);
      return;
    }
    if (slashMenuState.open && event.key === 'Escape') {
      event.preventDefault();
      closeSlashCommandMenu();
      return;
    }
    if (event.key === 'Backspace' && !event.target.value && state.promptCommands?.length) {
      event.preventDefault();
      removePromptCommand(state.promptCommands.at(-1).key);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessageFromCurrentView();
      return;
    }
  }
  if (event.key === 'Escape' && state.projectInstructionModalOpen) {
    closeProjectInstructionModal();
  } else if (event.key === 'Escape' && state.skillModalMode) {
    closeSkillModal();
  } else if (event.key === 'Escape' && document.querySelector('.skill-create-disclosure[open], .skill-actions-disclosure[open]')) {
    document.querySelectorAll('.skill-create-disclosure[open]').forEach((menu) => menu.removeAttribute('open'));
    document.querySelectorAll('.skill-actions-disclosure[open]').forEach((menu) => menu.removeAttribute('open'));
  } else if (event.key === 'Escape' && state.memoryModalScope) closeMemoryModal();
  else if (event.key === 'Escape' && state.settingsOpen) setState({ settingsOpen: false });
}

function renderCurrentView() {
  if (state.view === 'projects') return renderProjectsView();
  if (state.view === 'project') return renderProjectDetailView();
  if (state.view === 'customize') return renderCustomizeView();
  if (state.view === 'artifacts') return renderArtifactsView();
  return renderChatView();
}

function render() {
  const standaloneView = state.view === 'customize' || state.view === 'artifacts';
  app.innerHTML = `
    <div class="app-window">
      ${standaloneView ? `
        <div class="standalone-shell">
          ${renderWindowBar()}
          ${renderCurrentView()}
        </div>
      ` : `
        <div class="app-body">
          ${renderSidebar()}
          ${renderCurrentView()}
        </div>
      `}
      ${renderSettingsModal()}
      ${renderMemoryModal()}
      ${renderSkillModal()}
      ${renderProjectInstructionModal()}
    </div>
  `;
  document.querySelector('#messages')?.scrollTo({ top: 999999 });
}

app.addEventListener('click', handleClick);
app.addEventListener('change', handleChange);
app.addEventListener('input', handleInput);
app.addEventListener('keydown', handleKeydown);
render();
if (state.view === 'customize' && state.customizeSection === 'connectors') loadAtlassianConnectorStatus();
