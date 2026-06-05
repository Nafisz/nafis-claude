const STORAGE_KEY = 'nafisClaudeWorkspace:v2';
const CONTEXT_CHAR_BUDGET = 3_200_000;
const SESSION_SUMMARY_TRIGGER = 14;
const MEMORY_UPDATE_TURN_INTERVAL = 6;

const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

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
  text: 'Malam, siffan. Saya siap dipakai seperti workspace Claude: chat, Project memory, skill, dan artefak file. Isi API key lalu mulai bertanya.',
  createdAt: new Date().toISOString(),
};

const initialState = {
  model: DEFAULT_MODEL_ID,
  tone: 'Sedang',
  apiKey: '',
  apiKeySaved: false,
  activeProject: null,
  activeConversation: 1,
  activeArtifact: null,
  activeSkill: 'generate-file',
  showSkills: true,
  isSending: false,
  isMemoryUpdating: false,
  streamingMessageId: null,
  tokenCount: null,
  error: '',
  globalMemory: '',
  projectMemories: {},
  sessionSummaries: {},
  contextStats: {},
  memoryUpdatedAt: { global: '', projects: {}, sessions: {} },
  conversations: [
    { id: 1, title: 'Tanpa judul', projectId: null, model: DEFAULT_MODEL_ID, preview: 'Sesi umum di luar Project', updated: 'Baru saja' },
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
    return {
      ...structuredClone(initialState),
      ...stored,
      apiKey: stored.apiKeySaved ? stored.apiKey || '' : '',
      isSending: false,
      isMemoryUpdating: false,
      error: '',
      streamingMessageId: null,
      tokenCount: stored.tokenCount || null,
      projectMemories: stored.projectMemories || {},
      sessionSummaries: stored.sessionSummaries || {},
      contextStats: stored.contextStats || {},
      memoryUpdatedAt: stored.memoryUpdatedAt || { global: '', projects: {}, sessions: {} },
      activeSkill: stored.activeSkill || 'generate-file',
    };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  const persisted = {
    ...state,
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
  return defaultProjects.find((project) => project.id === id) ?? null;
}

function currentConversation() {
  return state.conversations.find((conversation) => conversation.id === state.activeConversation) ?? state.conversations[0];
}

function currentMessages() {
  return state.messagesByConversation[state.activeConversation] ?? [];
}

function generatedProjectMemory(projectId) {
  return state.projectMemories?.[projectId] || '';
}

function combineProjectMemory(project) {
  if (!project) return null;
  const generatedMemory = generatedProjectMemory(project.id);
  return {
    ...project,
    baseMemory: project.memory,
    systemPrompt: project.systemPrompt || project.memory || '',
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
  const builtinIds = defaultSkills.map((skill) => skill.id);
  const mergedBuiltins = defaultSkills.map((skill) => ({ ...skill, ...(storedSkills.find((item) => item.id === skill.id) || {}) }));
  const customSkills = storedSkills.filter((skill) => !builtinIds.includes(skill.id));
  return [...mergedBuiltins, ...customSkills];
}

function selectedSkill() {
  return activeSkills().find((skill) => skill.id === state.activeSkill) || activeSkills()[0];
}

function skillAsMarkdown(skill) {
  return [
    `# ${skill.name}`,
    '',
    `Active: ${skill.active ? 'yes' : 'no'}`,
    `Trigger keywords: ${(skill.triggerKeywords || []).join(', ') || '-'}`,
    '',
    '## Description',
    skill.description || '-',
    '',
    '## Instructions',
    skill.content || '-',
  ].join('\n');
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
  const lowerPrompt = prompt.toLowerCase();
  const skills = activeSkills();
  const actions = [];

  if (lowerPrompt.includes('jira')) {
    actions.push({
      type: 'tool',
      name: 'Jira search',
      detail: 'Tool Atlassian Jira tersedia lewat backend jika kredensial server sudah dikonfigurasi.',
    });
  }

  if (lowerPrompt.includes('confluence')) {
    const skill = skills.find((item) => item.id === 'confluence');
    actions.push({
      type: 'tool',
      name: 'Confluence search',
      detail: skill?.active
        ? 'Skill aktif. Claude diberi instruksi memakai konteks Confluence bila konektor tersedia.'
        : 'Skill nonaktif. Aktifkan checkbox Confluence sebelum memakai konektor ini.',
    });
  }

  if (/(buat|generate|hasilkan|tulis).*(file|\.md|\.txt|\.json|\.js|dokumen)/i.test(prompt)) {
    actions.push({ type: 'file', name: suggestFileName(prompt), detail: 'Artefak dibuat dari respons assistant dan bisa dibuka/diunduh.' });
  }

  if (assistantText && /(roadmap|prd|brief|spesifikasi|kode|dokumen)/i.test(prompt) && !actions.some((action) => action.type === 'file')) {
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

async function refreshTokenCount() {
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

function shouldUpdateMemories(messages = currentMessages()) {
  const stats = state.contextStats?.[state.activeConversation] || {};
  return userTurnCount(messages) - (stats.lastMemoryTurn || 0) >= MEMORY_UPDATE_TURN_INTERVAL;
}

function shouldSummarizeSession(messages = currentMessages()) {
  const stats = state.contextStats?.[state.activeConversation] || {};
  return messages.length - (stats.summarizedThrough || 0) >= SESSION_SUMMARY_TRIGGER;
}

async function requestMemory(scope, existingMemory) {
  const response = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey: state.apiKey,
      model: 'claude-haiku-4-5-20251001',
      scope,
      existingMemory,
      project: activeMemory(),
      messages: currentMessages(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Generate memory gagal.');
  return payload.memory || existingMemory || '';
}

function markMemoryGenerated(scopes) {
  const now = new Date().toISOString();
  const project = activeMemory();
  state.memoryUpdatedAt = {
    ...state.memoryUpdatedAt,
    global: scopes.includes('global') ? now : state.memoryUpdatedAt?.global || '',
    projects: {
      ...(state.memoryUpdatedAt?.projects || {}),
      ...(scopes.includes('project') && project ? { [project.id]: now } : {}),
    },
    sessions: {
      ...(state.memoryUpdatedAt?.sessions || {}),
      ...(scopes.includes('session') ? { [state.activeConversation]: now } : {}),
    },
  };
}

async function generateMemories(scopes = ['session', 'global', 'project'], force = false) {
  if (state.isMemoryUpdating) return;
  const messages = currentMessages();
  if (!force && !shouldUpdateMemories(messages) && !shouldSummarizeSession(messages)) return;

  state.isMemoryUpdating = true;
  saveState();
  render();

  const project = activeMemory();
  const completed = [];
  try {
    if (scopes.includes('session') && (force || shouldSummarizeSession(messages))) {
      state.sessionSummaries = {
        ...state.sessionSummaries,
        [state.activeConversation]: await requestMemory('session', currentSessionSummary()),
      };
      completed.push('session');
    }

    if (scopes.includes('global') && (force || shouldUpdateMemories(messages))) {
      state.globalMemory = await requestMemory('global', state.globalMemory);
      completed.push('global');
    }

    if (project && scopes.includes('project') && (force || shouldUpdateMemories(messages))) {
      state.projectMemories = {
        ...state.projectMemories,
        [project.id]: await requestMemory('project', generatedProjectMemory(project.id)),
      };
      completed.push('project');
    }

    if (completed.length) {
      const stats = state.contextStats?.[state.activeConversation] || {};
      state.contextStats = {
        ...state.contextStats,
        [state.activeConversation]: {
          ...stats,
          lastMemoryTurn: userTurnCount(messages),
          summarizedThrough: messages.length,
        },
      };
      markMemoryGenerated(completed);
    }
  } catch (error) {
    state.error = error.message;
  } finally {
    state.isMemoryUpdating = false;
    saveState();
    render();
  }
}

function createLocalFallback(prompt) {
  const memory = activeMemory();
  const actions = detectActions(prompt);
  const text = [
    'Mode lokal aktif karena API key belum tersedia atau request gagal.',
    memory ? `Memori Project yang dipakai: ${memory.name} — ${memory.memory}` : 'Sesi ini berjalan di luar Project.',
    'Setelah API key Claude dipasang, jawaban akan datang dari backend proxy `/api/chat-stream` dan model Claude yang dipilih.',
  ].join('\n\n');
  return { text, actions };
}

async function requestClaude(prompt, assistantId, conversationId) {
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
  const prompt = input.value.trim();
  if (!prompt || state.isSending) return;

  const conversationId = state.activeConversation;
  const userMessage = { id: crypto.randomUUID(), role: 'user', text: prompt, createdAt: new Date().toISOString() };
  const assistantId = crypto.randomUUID();
  const assistantPlaceholder = { id: assistantId, role: 'assistant', text: '', actions: [], model: currentModelId(), createdAt: new Date().toISOString() };

  state.messagesByConversation[conversationId] = currentMessages().concat(userMessage, assistantPlaceholder);
  updateConversationPreview(prompt);
  state.isSending = true;
  state.streamingMessageId = assistantId;
  state.error = '';
  saveState();
  render();
  refreshTokenCount();

  let reply;
  try {
    reply = await requestClaude(prompt, assistantId, conversationId);
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
  state.conversations = [{ id, title: 'Tanpa judul', projectId: state.activeProject, model: currentModelId(), preview: 'Sesi baru', updated: 'Baru saja' }, ...state.conversations];
  state.messagesByConversation[id] = [{
    ...welcomeMessage,
    id: crypto.randomUUID(),
    text: state.activeProject ? `Sesi baru di Project ${activeMemory()?.name}.` : 'Sesi baru di luar Project. Apa yang bisa saya bantu?',
  }];
  state.activeConversation = id;
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

function upsertSkill(nextSkill) {
  const skills = activeSkills();
  const exists = skills.some((skill) => skill.id === nextSkill.id);
  const nextSkills = exists
    ? skills.map((skill) => (skill.id === nextSkill.id ? { ...skill, ...nextSkill } : skill))
    : [...skills, nextSkill];
  setState({ skills: nextSkills, activeSkill: nextSkill.id });
}

function addCustomSkill() {
  const id = `custom-${Date.now()}`;
  upsertSkill({
    id,
    name: 'Skill baru',
    active: true,
    builtin: false,
    description: 'Jelaskan kapan skill ini dipakai.',
    content: 'Tulis instruksi skill ala Claude Skill di sini: workflow, batasan, output format, dan contoh pemakaian.',
  });
}

function saveSkillEditor() {
  const skill = selectedSkill();
  if (!skill) return;
  const name = document.querySelector('#skill-name-input')?.value.trim() || skill.name;
  const description = document.querySelector('#skill-description-input')?.value.trim() || '';
  const content = document.querySelector('#skill-content-input')?.value.trim() || '';
  upsertSkill({ ...skill, name, description, content });
}

function duplicateSelectedSkill() {
  const skill = selectedSkill();
  if (!skill) return;
  upsertSkill({
    ...skill,
    id: `custom-${Date.now()}`,
    name: `${skill.name} copy`,
    builtin: false,
    active: true,
  });
}

function deleteSelectedSkill() {
  const skill = selectedSkill();
  if (!skill || skill.builtin) return;
  const remaining = activeSkills().filter((item) => item.id !== skill.id);
  setState({ skills: remaining, activeSkill: remaining[0]?.id || defaultSkills[0].id });
}

function saveMemoryEditors() {
  const project = activeMemory();
  const globalMemory = document.querySelector('#global-memory-editor')?.value.trim() || '';
  const projectMemory = document.querySelector('#project-memory-editor')?.value.trim() || '';
  const now = new Date().toISOString();
  state.globalMemory = globalMemory;
  state.memoryUpdatedAt = {
    ...state.memoryUpdatedAt,
    global: now,
    projects: {
      ...(state.memoryUpdatedAt?.projects || {}),
      ...(project ? { [project.id]: now } : {}),
    },
    sessions: state.memoryUpdatedAt?.sessions || {},
  };
  if (project) {
    state.projectMemories = { ...state.projectMemories, [project.id]: projectMemory };
  }
  saveState();
  render();
}

function currentMemoryMarkdown() {
  const project = activeMemory();
  return [
    '# Memory',
    '',
    '## Global/account memory',
    document.querySelector('#global-memory-editor')?.value.trim() || state.globalMemory || '-',
    '',
    `## Project memory: ${project?.name || 'Di luar Project'}`,
    document.querySelector('#project-memory-editor')?.value.trim() || project?.generatedMemory || '-',
  ].join('\n');
}

function renderSidebar() {
  const recentItems = state.conversations.map((conversation) => {
    const project = projectById(conversation.projectId);
    const active = conversation.id === state.activeConversation ? 'active' : '';
    return `
      <button class="recent-item ${active}" data-conversation="${conversation.id}">
        <span>${escapeHtml(conversation.title)}</span>
        <small>${escapeHtml(project ? project.name : 'Di luar Project')} • ${escapeHtml(conversation.updated)}</small>
      </button>
    `;
  }).join('');

  return `
    <aside class="sidebar">
      <div class="brand-row">
        <div class="brand">Claude</div>
        <div class="icon-row"><button aria-label="Cari" data-action="focus-prompt">⌕</button><button aria-label="Panel" data-action="toggle-skills">◧</button></div>
      </div>

      <nav class="primary-nav" aria-label="Navigasi utama">
        <button class="nav-item strong" data-action="new-chat"><span>＋</span> Chat baru</button>
        <button class="nav-item" data-action="show-chats"><span>☏</span> Obrolan</button>
        <button class="nav-item" data-action="show-projects"><span>▣</span> Proyek</button>
        <button class="nav-item" data-action="show-artifacts"><span>◇</span> Artefak</button>
        <button class="nav-item" data-action="toggle-skills"><span>▤</span> Sesuaikan</button>
      </nav>

      <div class="sidebar-section">
        <p>Produk</p>
        <button class="nav-item" data-quick="Bantu saya membuat workspace cowork yang rapi untuk tim."><span>☷</span> Cowork</button>
        <button class="nav-item" data-quick="Bantu saya menulis dan mereview kode dengan langkah jelas."><span>&lt;/&gt;</span> Kode</button>
      </div>

      <div class="sidebar-section recents" id="recent-list">
        <div class="section-title"><p>Terbaru</p><button title="Filter" data-action="show-chats">⌘</button></div>
        ${recentItems}
      </div>
    </aside>
  `;
}

function renderProjectRail() {
  const rows = defaultProjects.map((project) => {
    const count = state.conversations.filter((conversation) => conversation.projectId === project.id).length;
    const active = state.activeProject === project.id ? 'selected' : '';
    return `
      <button class="project-card ${active}" data-project="${project.id}">
        <span class="project-dot ${project.color}"></span>
        <span><strong>${escapeHtml(project.name)}</strong><small>${count} sesi • memori khusus</small></span>
      </button>
    `;
  }).join('');
  const memory = activeMemory();

  return `
    <section class="project-rail ${state.showProjects ? '' : 'collapsed'}" id="project-rail">
      <div class="rail-header">
        <div>
          <p>Project folders</p>
          <h2>Memori per folder</h2>
        </div>
        <button data-project="outside">Umum</button>
      </div>
      <button class="project-card ${state.activeProject === null ? 'selected' : ''}" data-project="outside">
        <span class="project-dot neutral"></span>
        <span><strong>Di luar Project</strong><small>Sesi bebas tanpa memori folder</small></span>
      </button>
      ${rows}
      <div class="memory-card">
        <p>Memori aktif</p>
        <strong>${escapeHtml(memory?.name ?? 'Sesi umum')}</strong>
        <span>${escapeHtml(memory?.memory ?? 'Tidak memakai memori Project. Cocok untuk percakapan lintas topik.')}</span>
      </div>
    </section>
  `;
}

function renderActions(message) {
  return (message.actions ?? []).map((action) => `
    <div class="organic-action ${escapeHtml(action.type)}">
      <span>${action.type === 'tool' ? '🔧' : '📄'}</span>
      <div><strong>${escapeHtml(action.name)}</strong><small>${escapeHtml(action.detail)}</small></div>
    </div>
  `).join('');
}

function renderChat() {
  const memory = activeMemory();
  const messages = currentMessages().map((message) => `
    <article class="message ${escapeHtml(message.role)}">
      <div class="avatar">${message.role === 'assistant' ? '✺' : 'S'}</div>
      <div class="bubble">
        <p>${escapeHtml(message.text)}</p>
        ${message.usage ? `<small class="usage">${escapeHtml(message.model || state.model)} · input ${message.usage.input_tokens ?? 0} · output ${message.usage.output_tokens ?? 0}</small>` : ''}
        ${renderActions(message)}
      </div>
    </article>
  `).join('');

  return `
    <main class="workspace">
      <header class="topbar">
        <div class="plan-pill">API pribadi · <span>${state.apiKey ? 'Key siap' : 'Masukkan key'}</span></div>
        <button class="ghost-button" data-action="focus-prompt">👻</button>
      </header>

      <section class="hero">
        <div class="claude-mark">✺</div>
        <h1>Malam, siffan</h1>
        <p>${memory ? `Menggunakan memori Project “${escapeHtml(memory.name)}”.` : 'Sesi ini berada di luar Project dan tetap mandiri.'}</p>
      </section>

      <section class="chat-card" aria-label="Area percakapan">
        <div class="messages" id="messages">${messages}${state.isSending ? '<div class="typing">Claude sedang berpikir…</div>' : ''}</div>
        ${state.error ? `<div class="error-banner">${escapeHtml(state.error)}</div>` : ''}
        <div class="composer">
          <textarea id="prompt-input" placeholder="Apa yang bisa saya bantu hari ini? Coba: ‘buat file roadmap.md’ atau ‘cari di Confluence’" ${state.isSending ? 'disabled' : ''}></textarea>
          <div class="composer-footer">
            <div class="quick-actions">
              <button data-quick="Riset topik ini secara terstruktur:">Riset</button><button data-quick="Tulis kode untuk kebutuhan berikut:">&lt;/&gt; Kode</button><button data-quick="Bantu saya menulis dokumen berikut:">✎ Tulis</button><button data-quick="Ajari saya langkah demi langkah tentang:">▱ Belajar</button><button data-quick="Bantu urusan pribadi ini dengan checklist:">☕ Urusan pribadi</button>
            </div>
            <div class="model-controls">
              <select id="model-select" aria-label="Pilih model">
                ${defaultModels.map((model) => `<option value="${model.id}" ${model.id === currentModelId() ? 'selected' : ''}>${escapeHtml(model.label)}</option>`).join('')}
              </select>
              <select id="tone-select" aria-label="Pilih intensitas berpikir">
                ${['Rendah', 'Sedang', 'Tinggi'].map((tone) => `<option ${tone === state.tone ? 'selected' : ''}>${tone}</option>`).join('')}
              </select>
              <button title="Voice" data-quick="Transkrip voice saya:">🎙</button><button id="send-button" class="send-button" data-action="send-message" ${state.isSending ? 'disabled' : ''}>${state.isSending ? '■' : '↵'}</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
}


function formatMemoryTime(value) {
  if (!value) return 'Belum pernah';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderMemoryManager() {
  const project = activeMemory();
  const projectUpdatedAt = project ? state.memoryUpdatedAt?.projects?.[project.id] : '';
  const sessionUpdatedAt = state.memoryUpdatedAt?.sessions?.[state.activeConversation] || '';
  const stats = currentContextStats();

  return `
    <div class="inspector-card memory-manager">
      <div class="panel-heading">
        <p>Memory</p>
        <strong>${state.isMemoryUpdating ? 'Memperbarui…' : 'Akun dan Project'}</strong>
        <small>Memory dipakai otomatis saat chat.${state.tokenCount ? ` Token input: ${state.tokenCount}.` : ''}</small>
      </div>
      <div class="context-meter">
        <span style="width: ${Math.min(100, Math.round((stats.sentChars / Math.max(stats.totalChars, 1)) * 100))}%"></span>
      </div>
      <dl class="memory-list">
        <div><dt>Session summary</dt><dd>${escapeHtml(currentSessionSummary() || 'Belum ada ringkasan sesi.')}</dd><small>Update: ${escapeHtml(formatMemoryTime(sessionUpdatedAt))}</small></div>
        <div>
          <dt>Global/account memory</dt>
          <textarea id="global-memory-editor" class="memory-editor" placeholder="Tambahkan preferensi akun/global…">${escapeHtml(state.globalMemory || '')}</textarea>
          <small>Update: ${escapeHtml(formatMemoryTime(state.memoryUpdatedAt?.global))}</small>
        </div>
        <div>
          <dt>Project memory</dt>
          <textarea id="project-memory-editor" class="memory-editor" ${project ? '' : 'disabled'} placeholder="Pilih Project untuk mengedit memory project…">${escapeHtml(project?.generatedMemory || '')}</textarea>
          <small>${escapeHtml(project?.name || 'Di luar Project')} • Update: ${escapeHtml(formatMemoryTime(projectUpdatedAt))}</small>
        </div>
      </dl>
      <div class="editor-actions">
        <button data-action="save-memory">Simpan memory</button>
        <button data-action="copy-memory">Salin memory</button>
        <button data-action="download-memory">Unduh memory</button>
      </div>
      <small class="memory-hint">Memory diperbarui otomatis dan tetap bisa diedit manual.</small>
    </div>
  `;
}

function renderInspector() {
  const skillRows = activeSkills().map((skill) => `
    <div class="skill-row ${skill.id === state.activeSkill ? 'selected' : ''}">
      <input type="checkbox" data-skill="${skill.id}" ${skill.active ? 'checked' : ''} />
      <button data-skill-select="${skill.id}"><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.description)}</small></button>
    </div>
  `).join('');
  const skill = selectedSkill();

  const artifactRows = state.artifacts.map((artifact) => `
    <button class="artifact-row ${artifact.id === state.activeArtifact ? 'active' : ''}" data-artifact="${artifact.id}">
      <span>${artifact.type === 'file' ? '📄' : '📝'}</span>
      <div><strong>${escapeHtml(artifact.name)}</strong><small>${escapeHtml(artifact.detail)}</small></div>
    </button>
  `).join('');

  const activeArtifact = state.artifacts.find((artifact) => artifact.id === state.activeArtifact) ?? state.artifacts[0];

  return `
    <aside class="inspector ${state.showSkills ? 'open' : ''}" id="inspector">
      <div class="inspector-card api-card">
        <div class="panel-heading"><p>API Key</p><strong>Claude API proxy</strong><small>Isi key di sini atau jalankan server dengan ANTHROPIC_API_KEY.</small></div>
        <input id="api-key-input" type="password" placeholder="sk-ant-..." value="${escapeHtml(state.apiKey)}" />
        <label class="remember-row"><input type="checkbox" id="save-key" ${state.apiKeySaved ? 'checked' : ''} /> Simpan di browser ini</label>
      </div>
      ${renderMemoryManager()}
      <div class="inspector-card">
        <div class="panel-heading"><p>Model</p><strong>${escapeHtml(modelById(currentModelId()).label)}</strong><small>${escapeHtml(modelById(currentModelId()).detail)}</small></div>
      </div>
      <div class="inspector-card skill-manager">
        <div class="panel-heading"><p>Skills</p><strong>Claude-like editable skills</strong><small>Aktifkan, lihat, salin, unduh, edit, atau tambah skill kustom.</small></div>
        <div class="skill-list">${skillRows}</div>
        ${skill ? `
          <div class="skill-editor">
            <label>Nama skill<input id="skill-name-input" value="${escapeHtml(skill.name)}" /></label>
            <label>Deskripsi<textarea id="skill-description-input">${escapeHtml(skill.description || '')}</textarea></label>
            <label>Trigger keywords<input id="skill-keywords-input" value="${escapeHtml((skill.triggerKeywords || []).join(', '))}" /></label>
            <label>Instruksi skill<textarea id="skill-content-input">${escapeHtml(skill.content || '')}</textarea></label>
            <div class="editor-actions">
              <button data-action="save-skill">Simpan</button>
              <button data-action="copy-skill">Salin</button>
              <button data-action="download-skill">Unduh</button>
              <button data-action="duplicate-skill">Duplikat</button>
              ${skill.builtin ? '' : '<button data-action="delete-skill">Hapus</button>'}
            </div>
          </div>
        ` : ''}
        <button class="add-skill" data-action="add-skill">＋ Tambahkan skill</button>
      </div>
      <div class="inspector-card" id="artifact-panel">
        <div class="panel-heading"><p>Artefak</p><strong>File yang dihasilkan</strong></div>
        ${artifactRows}
        ${activeArtifact ? `
          <div class="artifact-preview">
            <div class="preview-actions"><strong>${escapeHtml(activeArtifact.name)}</strong><span><button data-copy="${activeArtifact.id}">Salin</button><button data-download="${activeArtifact.id}">Unduh</button></span></div>
            <pre>${escapeHtml(activeArtifact.content)}</pre>
          </div>
        ` : ''}
      </div>
    </aside>
  `;
}

function focusPrompt(prefix = '') {
  const input = document.querySelector('#prompt-input');
  if (!input) return;
  input.focus();
  if (prefix) input.value = `${prefix} ${input.value}`.trim();
}

function handleClick(event) {
  const conversationButton = event.target.closest('[data-conversation]');
  const projectButton = event.target.closest('[data-project]');
  const quickButton = event.target.closest('[data-quick]');
  const actionButton = event.target.closest('[data-action]');
  const artifactButton = event.target.closest('[data-artifact]');
  const downloadButton = event.target.closest('[data-download]');
  const copyButton = event.target.closest('[data-copy]');
  const skillSelectButton = event.target.closest('[data-skill-select]');

  if (conversationButton) {
    const activeConversation = Number(conversationButton.dataset.conversation);
    const conversation = state.conversations.find((item) => item.id === activeConversation);
    setState({ activeConversation, activeProject: conversation?.projectId ?? null });
    return;
  }

  if (projectButton) {
    moveConversationToProject(projectButton.dataset.project === 'outside' ? null : projectButton.dataset.project);
    return;
  }

  if (quickButton) {
    focusPrompt(quickButton.dataset.quick);
    return;
  }

  if (artifactButton) {
    setState({ activeArtifact: artifactButton.dataset.artifact });
    return;
  }

  if (downloadButton) {
    downloadArtifact(downloadButton.dataset.download);
    return;
  }

  if (copyButton) {
    copyArtifact(copyButton.dataset.copy);
    return;
  }

  if (skillSelectButton) {
    setState({ activeSkill: skillSelectButton.dataset.skillSelect });
    return;
  }

  if (!actionButton) return;

  const action = actionButton.dataset.action;
  if (action === 'new-chat') newConversation();
  if (action === 'send-message') addMessage();
  if (action === 'toggle-skills') setState({ showSkills: !state.showSkills });
  if (action === 'show-projects') document.querySelector('#project-rail')?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'show-artifacts') document.querySelector('#artifact-panel')?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'show-chats') document.querySelector('#recent-list')?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'focus-prompt') focusPrompt();
  if (action === 'add-skill') addCustomSkill();
  if (action === 'save-skill') saveSkillEditor();
  if (action === 'copy-skill') copyText(skillAsMarkdown(selectedSkill()));
  if (action === 'download-skill') downloadText(`${selectedSkill().name.toLowerCase().replaceAll(' ', '-')}.skill.md`, skillAsMarkdown(selectedSkill()));
  if (action === 'duplicate-skill') duplicateSelectedSkill();
  if (action === 'delete-skill') deleteSelectedSkill();
  if (action === 'save-memory') saveMemoryEditors();
  if (action === 'copy-memory') copyText(currentMemoryMarkdown());
  if (action === 'download-memory') downloadText('workspace-memory.md', currentMemoryMarkdown());
}

function handleChange(event) {
  if (event.target.id === 'model-select') {
    state.conversations = state.conversations.map((conversation) => (conversation.id === state.activeConversation ? { ...conversation, model: event.target.value } : conversation));
    setState({ model: event.target.value });
  }
  if (event.target.id === 'tone-select') setState({ tone: event.target.value });
  if (event.target.id === 'save-key') setState({ apiKeySaved: event.target.checked });
  if (event.target.dataset.skill) {
    const id = event.target.dataset.skill;
    const skills = activeSkills().map((skill) => (skill.id === id ? { ...skill, active: event.target.checked } : skill));
    setState({ skills });
  }
}

function handleInput(event) {
  if (event.target.id === 'api-key-input') {
    state.apiKey = event.target.value.trim();
    if (state.apiKeySaved) saveState();
  }
}

function handleKeydown(event) {
  if (event.target.id === 'prompt-input' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    addMessage();
  }
}

function render() {
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar()}
      ${renderProjectRail()}
      ${renderChat()}
      ${renderInspector()}
    </div>
  `;
  document.querySelector('#messages')?.scrollTo({ top: 999999 });
}

app.addEventListener('click', handleClick);
app.addEventListener('change', handleChange);
app.addEventListener('input', handleInput);
app.addEventListener('keydown', handleKeydown);
render();
