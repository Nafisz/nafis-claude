import { marked } from '/node_modules/marked/lib/marked.esm.js';

const STORAGE_KEY = 'nafisClaudeWorkspace:v2';
const CONTEXT_CHAR_BUDGET = 3_200_000;
const SESSION_SUMMARY_TRIGGER = 14;
const MEMORY_UPDATE_TURN_INTERVAL = 6;
const PROJECT_FILE_EXTENSIONS = new Set(['md', 'txt', 'json', 'csv', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'xml', 'yaml', 'yml']);

const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
const MEMORY_MODEL_ID = 'claude-haiku-4-5-20251001';
const MEMORY_SECTION_TITLES = [
  'Work context',
  'Personal context',
  'Top of mind',
  'Brief history',
  'Recent months',
  'Earlier context',
  'Long-term background',
  'Purpose & context',
  'Current state',
  'On the horizon',
  'Key learnings & principles',
  'Approach & patterns',
  'Tools & resources',
];

const defaultModels = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', tier: 'max', detail: 'Maximum reasoning.' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7', tier: 'max', detail: 'Deep reasoning.' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', tier: 'max', detail: 'Deepest reasoning.' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', tier: 'default', detail: 'Default for daily work and architecture.' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', tier: 'fast', detail: 'Fast and cost efficient.' },
];

const modelKeyFamilies = [
  { id: 'opus', label: 'Opus', pattern: /opus/i, detail: 'Used by all Opus models.' },
  { id: 'sonnet', label: 'Sonnet', pattern: /sonnet/i, detail: 'Used by all Sonnet models.' },
  { id: 'haiku', label: 'Haiku', pattern: /haiku/i, detail: 'Used by all Haiku models and memory.' },
];

const toneOptions = ['Low', 'Medium', 'High'];
const toneAliases = { Rendah: 'Low', Sedang: 'Medium', Tinggi: 'High' };

function normalizeTone(value) {
  const tone = toneAliases[value] || value || 'Medium';
  return toneOptions.includes(tone) ? tone : 'Medium';
}

function splitApiKeys(value) {
  if (Array.isArray(value)) return value.flatMap(splitApiKeys);
  return String(value || '')
    .split(/[\r\n,]+/)
    .map((key) => key.trim())
    .filter(Boolean);
}

function compactApiKeysByModel(source = {}) {
  return Object.fromEntries(modelKeyFamilies.map((family) => [
    family.id,
    [...new Set(splitApiKeys(source[family.id]))],
  ]));
}

function emptyApiKeysByModel() {
  return Object.fromEntries(modelKeyFamilies.map((family) => [family.id, []]));
}

function normalizeStoredApiKeys(source = {}, legacyKey = '') {
  const compact = compactApiKeysByModel(source);
  const legacyKeys = splitApiKeys(legacyKey);
  const hasFamilyKeys = Object.values(compact).some((keys) => keys.length);
  return Object.fromEntries(modelKeyFamilies.map((family) => [
    family.id,
    compact[family.id].length ? compact[family.id] : (hasFamilyKeys ? [] : legacyKeys),
  ]));
}

function modelKeyFamilyForModel(modelId = DEFAULT_MODEL_ID) {
  return modelKeyFamilies.find((family) => family.pattern.test(String(modelId || '')))?.id || 'sonnet';
}

const defaultSkills = [
  {
    id: 'confluence',
    name: 'Confluence',
    active: false,
    builtin: true,
    description: 'Search pages, read the workspace, and summarize internal docs when the connector is available.',
    triggerKeywords: ['confluence', 'wiki', 'page', 'internal docs'],
    content: 'Use this skill when the user asks for Confluence context. Explain when the connector is unavailable and do not invent page content.',
  },
  {
    id: 'generate-file',
    name: 'Generate File',
    active: true,
    builtin: true,
    description: 'Create documents, code, and artifacts as files that can be opened or downloaded.',
    triggerKeywords: ['file', 'generate', 'document', '.md', '.txt', '.json', '.js'],
    content: 'When the user asks for a file, produce ready-to-use content, give it a clear filename, and save it as a conversation artifact.',
  },
  {
    id: 'product-analysis',
    name: 'Product Analysis',
    active: true,
    builtin: true,
    description: 'Draft PRDs, roadmaps, metrics, and competitor research.',
    triggerKeywords: ['prd', 'roadmap', 'product', 'metric', 'research'],
    content: 'Use a product structure: problem, target user, assumptions, features, success metrics, risks, and next steps.',
  },
  {
    id: 'ui-design',
    name: 'UI Design',
    active: true,
    builtin: true,
    description: 'Give visual critique and produce interface specifications.',
    triggerKeywords: ['ui', 'ux', 'design', 'interface'],
    content: 'Evaluate UI by hierarchy, spacing, contrast, affordance, accessibility, responsive behavior, and microcopy.',
  },
];

const promptToolCommands = [
  { id: 'atlassian_confluence_search', command: 'confluence-search', label: 'Search Confluence', description: 'Search Confluence pages by keyword.' },
  { id: 'atlassian_confluence_get_page', command: 'confluence-page', label: 'Read Confluence page', description: 'Read one Confluence page by page ID.' },
  { id: 'atlassian_confluence_update_page', command: 'confluence-update', label: 'Update Confluence page', description: 'Update a Confluence page after reading the latest version.' },
  { id: 'atlassian_jira_search', command: 'jira-search', label: 'Search Jira', description: 'Search Jira issues by text or JQL.' },
  { id: 'atlassian_jira_get_issue', command: 'jira-issue', label: 'Read Jira issue', description: 'Read one Jira issue by issue key.' },
  { id: 'atlassian_jira_create_issue', command: 'jira-create', label: 'Create Jira issue', description: 'Create a Jira issue when explicitly requested.' },
  { id: 'atlassian_jira_update_issue', command: 'jira-update', label: 'Update Jira issue', description: 'Update fields on the selected Jira issue.' },
  { id: 'atlassian_jira_add_comment', command: 'jira-comment', label: 'Comment on Jira issue', description: 'Add a comment to a Jira issue.' },
];

const defaultProjects = [
  {
    id: 'nova',
    name: 'NovaX Edtech',
    systemPrompt: 'Use Bahasa Indonesia for responses; focus on B2B edtech for schools and bootcamps.',
    memory: 'Use Bahasa Indonesia for responses; focus on B2B edtech for schools and bootcamps.',
    color: 'apricot',
  },
  {
    id: 'game',
    name: 'AI Game Lab',
    systemPrompt: 'Preference: rapid prototypes, NPC agents, lightweight Godot/Unity, gameplay before visuals.',
    memory: 'Preference: rapid prototypes, NPC agents, lightweight Godot/Unity, gameplay before visuals.',
    color: 'sage',
  },
  {
    id: 'ops',
    name: 'Personal Ops',
    systemPrompt: 'Prioritize executive summaries, weekly checklists, and work-document integrations.',
    memory: 'Prioritize executive summaries, weekly checklists, and work-document integrations.',
    color: 'violet',
  },
];

const welcomeMessage = {
  id: crypto.randomUUID(),
  role: 'assistant',
  text: 'Good evening, siffan. I can help with chat, project memory, skills, and file artifacts.',
  createdAt: new Date().toISOString(),
};

const defaultBriefContent = '# Project Brief\n\nUse this panel to store project context that AI can retrieve.';
const defaultProjectFile = {
  id: crypto.randomUUID(),
  name: 'project-brief.md',
  type: 'text/markdown',
  size: new Blob([defaultBriefContent]).size,
  content: defaultBriefContent,
  included: true,
  addedAt: new Date().toISOString(),
};

const initialState = {
  model: DEFAULT_MODEL_ID,
  tone: 'Medium',
  apiKey: '',
  apiKeysByModel: emptyApiKeysByModel(),
  apiKeySaved: true,
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
  backendFilesMigrated: false,
  projectFileError: '',
  selectedProjectFileIds: [],
  conversationFiles: {},
  conversationFileError: '',
  memoryModalScope: null,
  memoryModalEditing: false,
  memoryEditDraft: '',
  memoryModalError: '',
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
    { id: 1, title: 'Untitled', projectId: null, model: DEFAULT_MODEL_ID, preview: 'Standalone session', updated: 'Just now' },
    { id: 2, title: 'Simple AI game vs LLMs for NPCs', projectId: 'game', model: DEFAULT_MODEL_ID, preview: 'Gameplay and prompt experiments', updated: '2 hours ago' },
    { id: 3, title: 'Claude app vs API usage differences', projectId: null, model: DEFAULT_MODEL_ID, preview: 'General notes across projects', updated: 'Yesterday' },
    { id: 4, title: 'MVP-ready architecture design', projectId: 'nova', model: DEFAULT_MODEL_ID, preview: 'Backend, auth, and billing', updated: 'Monday' },
  ],
  messagesByConversation: {
    1: [welcomeMessage],
    2: [{ ...welcomeMessage, id: crypto.randomUUID(), text: 'AI Game Lab is active. Should we design NPCs, the gameplay loop, or the technical prototype first?' }],
    3: [{ ...welcomeMessage, id: crypto.randomUUID(), text: 'We can compare the Claude app and API by features, pricing, latency, and integration.' }],
    4: [{ ...welcomeMessage, id: crypto.randomUUID(), text: 'NovaX is active. I will keep the B2B edtech context in mind when answering.' }],
  },
  artifacts: [
    {
      id: crypto.randomUUID(),
      type: 'doc',
      name: 'project-brief.md',
      detail: 'Example starter artifact that can be opened and downloaded.',
      content: '# Project Brief\n\nUse this panel to store Claude-like output as a real browser file.',
      createdAt: new Date().toISOString(),
    },
  ],
};

let state = loadState();
let backendStateLoaded = false;
let stateSaveTimer = null;
let pendingPersistedState = null;
let stateSaveChain = Promise.resolve();
const app = document.querySelector('#app');

function normalizePersistedState(stored = {}) {
  const conversations = (stored.conversations || initialState.conversations).map((conversation) => ({
    ...conversation,
    model: defaultModels.some((model) => model.id === conversation.model) ? conversation.model : DEFAULT_MODEL_ID,
  }));
  return {
      ...structuredClone(initialState),
      ...stored,
      model: defaultModels.some((model) => model.id === stored.model) ? stored.model : DEFAULT_MODEL_ID,
      conversations,
      apiKey: stored.apiKey || '',
      apiKeysByModel: normalizeStoredApiKeys(stored.apiKeysByModel, stored.apiKey || ''),
      apiKeySaved: true,
      tone: normalizeTone(stored.tone),
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
      settingsSection: 'general',
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
              : (stored.artifacts || []).filter((artifact) => ['brief-proyek.md', 'project-brief.md'].includes(artifact.name)).map((artifact) => ({
                  id: crypto.randomUUID(),
                  name: artifact.name === 'brief-proyek.md' ? 'project-brief.md' : artifact.name,
                  type: 'text/markdown',
                  size: new Blob([artifact.content || '']).size,
                  content: artifact.content || '',
                  included: true,
                  addedAt: artifact.createdAt || new Date().toISOString(),
                }))),
          },
      projectFilesMigrated: true,
      backendFilesMigrated: Boolean(stored.backendFilesMigrated),
      projectFileError: '',
      selectedProjectFileIds: [],
      conversationFiles: stored.conversationFiles || {},
      conversationFileError: '',
      memoryModalScope: null,
      memoryModalEditing: false,
      memoryEditDraft: '',
      memoryModalError: '',
    };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialState);

  try {
    return normalizePersistedState(JSON.parse(raw));
  } catch {
    return structuredClone(initialState);
  }
}

const pendingLegacyProjectFiles = [];

function fileMetadata(file) {
  const { content, ...metadata } = file;
  return metadata;
}

function metadataByScope(filesByScope = {}) {
  return Object.fromEntries(Object.entries(filesByScope).map(([scopeId, files]) => (
    [scopeId, (files || []).map(fileMetadata)]
  )));
}

function prepareLoadedStateFiles() {
  pendingLegacyProjectFiles.splice(0, pendingLegacyProjectFiles.length, ...Object.entries(state.projectFiles || {}).flatMap(([projectId, files]) => (
    (files || [])
      .filter((file) => typeof file.content === 'string')
      .map((file) => ({ projectId, ...file }))
  )));
  state.projectFiles = metadataByScope(state.projectFiles);
  state.conversationFiles = metadataByScope(state.conversationFiles);
}

function configuredApiKeysByModel() {
  return compactApiKeysByModel(state.apiKeysByModel || {});
}

function apiKeysForFamily(familyId) {
  return configuredApiKeysByModel()[familyId] || [];
}

function apiKeyInputsForFamily(familyId) {
  const savedKeys = state.apiKeysByModel?.[familyId] || [];
  return savedKeys.length ? savedKeys : [''];
}

function apiKeysForModelId(modelId = currentModelId()) {
  return apiKeysForFamily(modelKeyFamilyForModel(modelId));
}

function hasApiKeysForModel(modelId = currentModelId()) {
  return apiKeysForModelId(modelId).length > 0;
}

function apiKeysForRequest(_modelId = currentModelId()) {
  return {};
}

function firstConfiguredApiKey() {
  return modelKeyFamilies.flatMap((family) => apiKeysForFamily(family.id))[0] || '';
}

prepareLoadedStateFiles();

function buildPersistedState() {
  const {
    apiKey,
    apiKeysByModel,
    connectorStatus,
    connectorBusy,
    skillFileError,
    promptDraft,
    promptCommands,
    projectInstructionModalOpen,
    projectFileError,
    selectedProjectFileIds,
    conversationFileError,
    memoryModalScope,
    memoryModalEditing,
    memoryEditDraft,
    memoryModalError,
    ...persistableState
  } = state;
  const persisted = {
    ...persistableState,
    projectFiles: metadataByScope(state.projectFiles),
    conversationFiles: metadataByScope(state.conversationFiles),
    apiKey: firstConfiguredApiKey(),
    apiKeysByModel: configuredApiKeysByModel(),
    apiKeySaved: true,
    isSending: false,
    isMemoryUpdating: false,
    error: '',
    streamingMessageId: null,
  };
  return persisted;
}

async function writeBackendState(persisted) {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: persisted }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Failed to save backend state.');
  return payload;
}

function persistStateNow() {
  if (!backendStateLoaded) return Promise.resolve();
  const persisted = pendingPersistedState || buildPersistedState();
  pendingPersistedState = null;
  stateSaveChain = stateSaveChain
    .catch(() => {})
    .then(() => writeBackendState(persisted))
    .catch((error) => {
      state.error = error.message || 'Failed to save backend state.';
      render();
    });
  return stateSaveChain;
}

function flushStateSave() {
  if (stateSaveTimer) {
    clearTimeout(stateSaveTimer);
    stateSaveTimer = null;
  }
  return persistStateNow();
}

function saveState({ immediate = false } = {}) {
  pendingPersistedState = buildPersistedState();
  if (!backendStateLoaded) return Promise.resolve();
  if (immediate) return flushStateSave();
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(() => {
    stateSaveTimer = null;
    persistStateNow();
  }, 350);
  return Promise.resolve();
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

function selectedProjectFileIds(projectId) {
  return projectFiles(projectId).map((file) => file.id);
}

function conversationFiles(conversationId = state.activeConversation) {
  return state.conversationFiles?.[conversationId] || [];
}

function selectedConversationFileIds(conversationId = state.activeConversation) {
  return conversationFiles(conversationId)
    .filter((file) => file.included !== false)
    .map((file) => file.id);
}

function combineProjectMemory(project) {
  if (!project) return null;
  const generatedMemory = generatedProjectMemory(project.id);
  return {
    ...project,
    baseMemory: project.memory,
    systemPrompt: projectInstruction(project),
    fileIds: selectedProjectFileIds(project.id),
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
      description: skill.description || 'Run this skill for the next prompt.',
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
  return prompt.length > 44 ? `${prompt.slice(0, 44)}...` : prompt || 'Untitled';
}

function updateConversationPreview(prompt) {
  state.conversations = state.conversations.map((conversation) => {
    if (conversation.id !== state.activeConversation) return conversation;
    return {
      ...conversation,
      title: conversation.title === 'Untitled' ? titleFromPrompt(prompt) : conversation.title,
      preview: prompt.slice(0, 72),
      updated: 'Just now',
      projectId: state.activeProject,
      model: conversation.model || currentModelId(),
    };
  });
}

function detectActions(prompt, assistantText = '') {
  const actions = [];
  const fileSkill = activeSkills().find((skill) => skill.id === 'generate-file');

  if (fileSkill?.active && /(buat|generate|hasilkan|tulis).*(file|\.md|\.txt|\.json|\.js|dokumen)/i.test(prompt)) {
    actions.push({ type: 'file', name: suggestFileName(prompt), detail: 'Artifact created from the assistant response and available to open or download.' });
  }

  if (fileSkill?.active && assistantText && /(roadmap|prd|brief|spesifikasi|kode|dokumen)/i.test(prompt) && !actions.some((action) => action.type === 'file')) {
    actions.push({ type: 'file', name: suggestFileName(prompt), detail: 'Important output saved as a reusable artifact.' });
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
    content: content || `# ${action.name}\n\nNo content yet.`,
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
  return `Sending ${stats.sentMessages}/${stats.totalMessages} messages (${stats.sentChars}/${stats.totalChars} characters) + ${stats.hasSummary ? 'session summary' : 'no summary'} + memory.`;
}

async function refreshTokenCount(triggers = selectedPromptTriggers()) {
  const model = currentModelId();
  if (!hasApiKeysForModel(model)) return;
  try {
    await flushStateSave();
    const response = await fetch('/api/count-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKeysByModel: apiKeysForRequest(model),
        model,
        tone: state.tone,
        project: activeMemory(),
        conversationId: String(state.activeConversation),
        conversationFileIds: selectedConversationFileIds(),
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
  const model = MEMORY_MODEL_ID;
  await flushStateSave();
  const maxTokens = scope === 'session' ? 900 : scope === 'global' ? 2600 : 1800;
  const response = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKeysByModel: apiKeysForRequest(model),
      model,
      maxTokens,
      scope,
      existingMemory,
      project: context.project,
      instruction: context.instruction || '',
      messages: context.messages,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Failed to generate memory.');
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
  if (state.isMemoryUpdating || !hasApiKeysForModel(MEMORY_MODEL_ID)) return;
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
      failures.push(result.reason?.message || `${scope} memory failed.`);
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
  const family = modelKeyFamilies.find((item) => item.id === modelKeyFamilyForModel(currentModelId()));
  const modelLabel = family?.label || modelById(currentModelId()).label;
  const text = [
    `Local mode is active because the ${modelLabel} API key is unavailable or every ${modelLabel} key failed.`,
    memory ? `Project memory in use: ${memory.name} - ${memory.memory}` : '',
    'Add the model API key in Settings so answers come from the `/api/chat-stream` backend proxy and use the selected model.',
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
  if (!response.ok) throw new Error(data.error || `Connector request failed (${response.status}).`);
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
    setConnectorState({ error: 'Enter the site URL, email, and API token first.' });
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
  const requestModel = currentModelId();
  await flushStateSave();
  const response = await fetch('/api/chat-stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKeysByModel: apiKeysForRequest(requestModel),
      model: requestModel,
      tone: state.tone,
      project: activeMemory(),
      conversationId: String(conversationId),
      conversationFileIds: selectedConversationFileIds(conversationId),
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
    throw new Error(payload.error || 'Claude API failed to respond.');
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
      throw new Error(payload.error || 'Claude API failed to respond.');
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
    attachedFiles: conversationFiles(conversationId)
      .filter((file) => file.included !== false)
      .map(({ id, name, type, size }) => ({ id, name, type, size })),
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
  state.conversations = [{ id, title: 'Untitled', projectId: null, model: currentModelId(), preview: 'New session', updated: 'Just now' }, ...state.conversations];
  state.messagesByConversation[id] = [{
    ...welcomeMessage,
    id: crypto.randomUUID(),
    text: 'How can I help?',
  }];
  state.conversationFiles = { ...(state.conversationFiles || {}), [id]: [] };
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
  state.conversationFiles = { ...(state.conversationFiles || {}), [id]: [] };
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

function formatLineCount(lines = 0) {
  return Number(lines || 0).toLocaleString('en-US');
}

function projectFileExtension(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || '';
}

async function fileApi(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `File request failed (${response.status}).`);
  return payload;
}

async function listStoredFiles(scope, scopeId) {
  const query = new URLSearchParams({ scope, scopeId: String(scopeId) });
  const payload = await fileApi(`/api/files?${query}`);
  return payload.files || [];
}

async function uploadStoredFile(file, scope, scopeId) {
  const payload = await fileApi('/api/files', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
      'x-file-scope': scope,
      'x-file-scope-id': encodeURIComponent(String(scopeId)),
      'x-file-included': 'true',
    },
    body: file,
  });
  return payload.file;
}

async function updateStoredFile(fileId, included) {
  const payload = await fileApi(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ included }),
  });
  return payload.file;
}

async function deleteStoredFile(fileId) {
  await fileApi(`/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

async function loadProjectFiles(projectId, shouldRender = true) {
  const files = await listStoredFiles('project', projectId);
  state.projectFiles = { ...(state.projectFiles || {}), [projectId]: files };
  const availableIds = new Set(files.map((file) => file.id));
  state.selectedProjectFileIds = (state.selectedProjectFileIds || []).filter((id) => availableIds.has(id));
  state.projectFileError = '';
  saveState();
  if (shouldRender) render();
  return files;
}

async function loadConversationFiles(conversationId = state.activeConversation, shouldRender = true) {
  const files = await listStoredFiles('conversation', conversationId);
  state.conversationFiles = { ...(state.conversationFiles || {}), [conversationId]: files };
  state.conversationFileError = '';
  saveState();
  if (shouldRender) render();
  return files;
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

  const invalid = incoming.find((file) => !PROJECT_FILE_EXTENSIONS.has(projectFileExtension(file.name)));
  if (invalid) {
    setState({ projectFileError: `${invalid.name} is not a supported text file.` }, false);
    return;
  }

  try {
    await Promise.all(incoming.map((file) => uploadStoredFile(file, 'project', project.id)));
    await loadProjectFiles(project.id);
  } catch (error) {
    setState({ projectFileError: error.message || 'Could not upload the file.' }, false);
  }
}

function toggleProjectFileSelection(fileId) {
  const selected = new Set(state.selectedProjectFileIds || []);
  if (selected.has(fileId)) selected.delete(fileId);
  else selected.add(fileId);
  state.selectedProjectFileIds = [...selected];
  render();
}

function toggleAllProjectFileSelection() {
  const project = projectById(state.activeProject);
  if (!project) return;
  const allIds = projectFiles(project.id).map((file) => file.id);
  const selected = new Set(state.selectedProjectFileIds || []);
  state.selectedProjectFileIds = allIds.length && allIds.every((id) => selected.has(id)) ? [] : allIds;
  render();
}

function clearProjectFileSelection() {
  state.selectedProjectFileIds = [];
  render();
}

async function removeProjectFile(fileId) {
  const project = projectById(state.activeProject);
  if (!project) return;
  try {
    await deleteStoredFile(fileId);
    state.projectFiles = {
      ...(state.projectFiles || {}),
      [project.id]: projectFiles(project.id).filter((file) => file.id !== fileId),
    };
    state.selectedProjectFileIds = (state.selectedProjectFileIds || []).filter((id) => id !== fileId);
    state.projectFileError = '';
    saveState();
    render();
  } catch (error) {
    setState({ projectFileError: error.message || 'Failed to delete the file.' }, false);
  }
}

async function removeSelectedProjectFiles() {
  const project = projectById(state.activeProject);
  const selectedIds = [...(state.selectedProjectFileIds || [])];
  if (!project || !selectedIds.length) return;
  const results = await Promise.allSettled(selectedIds.map((fileId) => deleteStoredFile(fileId)));
  const removedIds = new Set(results.flatMap((result, index) => (result.status === 'fulfilled' ? [selectedIds[index]] : [])));
  state.projectFiles = {
    ...(state.projectFiles || {}),
    [project.id]: projectFiles(project.id).filter((file) => !removedIds.has(file.id)),
  };
  state.selectedProjectFileIds = selectedIds.filter((id) => !removedIds.has(id));
  const failedCount = results.length - removedIds.size;
  state.projectFileError = failedCount ? `${failedCount} file(s) failed to delete.` : '';
  saveState();
  render();
}

async function importConversationFiles(fileList) {
  const incoming = [...(fileList || [])];
  if (!incoming.length) return;
  const invalid = incoming.find((file) => !PROJECT_FILE_EXTENSIONS.has(projectFileExtension(file.name)));
  if (invalid) {
    setState({ conversationFileError: `${invalid.name} is not a supported text file.` }, false);
    return;
  }
  try {
    await Promise.all(incoming.map((file) => uploadStoredFile(file, 'conversation', state.activeConversation)));
    await loadConversationFiles(state.activeConversation);
  } catch (error) {
    setState({ conversationFileError: error.message || 'Could not upload the file.' }, false);
  }
}

async function toggleConversationFileContext(fileId) {
  const current = conversationFiles().find((file) => file.id === fileId);
  if (!current) return;
  try {
    const updated = await updateStoredFile(fileId, current.included === false);
    state.conversationFiles = {
      ...(state.conversationFiles || {}),
      [state.activeConversation]: conversationFiles().map((file) => (file.id === fileId ? updated : file)),
    };
    saveState();
    render();
  } catch (error) {
    setState({ conversationFileError: error.message || 'Failed to update the context file.' }, false);
  }
}

async function removeConversationFile(fileId) {
  try {
    await deleteStoredFile(fileId);
    state.conversationFiles = {
      ...(state.conversationFiles || {}),
      [state.activeConversation]: conversationFiles().filter((file) => file.id !== fileId),
    };
    state.conversationFileError = '';
    saveState();
    render();
  } catch (error) {
    setState({ conversationFileError: error.message || 'Failed to delete the file.' }, false);
  }
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
    setState({ skillFileError: 'Upload skills as Markdown (.md) files.' }, false);
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
    setState({ skillFileError: 'Replacement skills must be Markdown (.md) files.' }, false);
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
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function validApiKeyFamily(familyId) {
  return modelKeyFamilies.some((family) => family.id === familyId);
}

function setApiKeyValue(familyId, index, value) {
  if (!validApiKeyFamily(familyId)) return;
  const rows = [...apiKeyInputsForFamily(familyId)];
  rows[Number(index)] = String(value || '').trim();
  state.apiKeysByModel = {
    ...(state.apiKeysByModel || {}),
    [familyId]: rows,
  };
  saveState({ immediate: true });
}

function focusApiKeyInput(familyId, index) {
  queueMicrotask(() => {
    document.querySelector(`[data-api-key-family="${familyId}"][data-api-key-index="${index}"]`)?.focus();
  });
}

function addApiKeyRow(familyId) {
  if (!validApiKeyFamily(familyId)) return;
  const rows = apiKeyInputsForFamily(familyId);
  const nextRows = rows.length === 1 && !rows[0] ? ['', ''] : [...rows, ''];
  state.apiKeysByModel = {
    ...(state.apiKeysByModel || {}),
    [familyId]: nextRows,
  };
  saveState();
  render();
  focusApiKeyInput(familyId, nextRows.length - 1);
}

function removeApiKeyRow(familyId, index) {
  if (!validApiKeyFamily(familyId)) return;
  const nextRows = apiKeyInputsForFamily(familyId).filter((_, rowIndex) => rowIndex !== Number(index));
  state.apiKeysByModel = {
    ...(state.apiKeysByModel || {}),
    [familyId]: nextRows.length ? nextRows : [],
  };
  saveState();
  render();
  focusApiKeyInput(familyId, Math.max(0, Number(index) - 1));
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
  state.memoryEditDraft = '';
  state.memoryModalError = '';
  saveState();
  render();
}

function closeMemoryModal() {
  state.memoryModalScope = null;
  state.memoryModalEditing = false;
  state.memoryEditDraft = '';
  state.memoryModalError = '';
  saveState();
  render();
}

function startMemoryModalEditing() {
  state.memoryModalEditing = true;
  state.memoryEditDraft = '';
  state.memoryModalError = '';
  render();
  document.querySelector('#memory-edit-input')?.focus();
}

function syncMemoryEditSubmitState() {
  const input = document.querySelector('#memory-edit-input');
  const button = document.querySelector('[data-action="submit-memory-edit"]');
  if (!input || !button) return;
  button.disabled = !input.value.trim() || state.isMemoryUpdating;
}

async function submitMemoryEdit() {
  const scope = state.memoryModalScope;
  const instruction = document.querySelector('#memory-edit-input')?.value.trim() || state.memoryEditDraft.trim();
  if (!scope || !instruction || state.isMemoryUpdating) return;

  state.memoryEditDraft = instruction;
  state.memoryModalError = '';
  state.isMemoryUpdating = true;
  saveState();
  render();

  const project = scope === 'project' ? memoryModalProject() : null;
  try {
    const memory = await requestMemory(scope, memoryModalContent(), {
      instruction,
      project: project ? combineProjectMemory(project) : null,
      messages: buildContextMessages(),
    });
    const now = new Date().toISOString();
    if (scope === 'global') {
      state.globalMemory = memory;
      state.memoryUpdatedAt = { ...state.memoryUpdatedAt, global: now };
    } else if (project) {
      state.projectMemories = { ...state.projectMemories, [project.id]: memory };
      state.memoryUpdatedAt = {
        ...state.memoryUpdatedAt,
        projects: { ...(state.memoryUpdatedAt?.projects || {}), [project.id]: now },
      };
    }
    state.memoryModalEditing = false;
    state.memoryEditDraft = '';
  } catch (error) {
    state.memoryModalError = error.message || 'Failed to update memory.';
  } finally {
    state.isMemoryUpdating = false;
    saveState();
    render();
  }
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
  }));
}

function renderMemoryDocument(memory) {
  const sections = parseMemoryForDisplay(memory);
  if (!sections.length) return '<p class="memory-empty">No memory yet.</p>';
  return sections.map((section) => {
    const paragraphs = section.content
      ? section.content
        .split(/\n\s*\n/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
        .join('')
      : '';
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
        ${message.attachedFiles?.length ? `<div class="message-file-list">${message.attachedFiles.map((file) => `<span>${phIcon('paperclip')} ${escapeHtml(file.name)}</span>`).join('')}</div>` : ''}
        <p>${escapeHtml(message.text)}</p>
        ${message.usage ? `<small class="usage">${escapeHtml(message.model || state.model)} · input ${message.usage.input_tokens ?? 0} · output ${message.usage.output_tokens ?? 0}</small>` : ''}
        ${renderActions(message)}
        ${message.role === 'assistant' && !state.isSending ? `<button class="branch-message" data-branch-message="${message.id}">${icon('fork_right')} Branch from here</button>` : ''}
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

function renderConversationFileChips() {
  return conversationFiles().map((file) => `
    <div class="chat-file-chip ${file.included === false ? 'excluded' : ''}">
      <button class="chat-file-context" data-conversation-file-toggle="${file.id}" aria-pressed="${file.included !== false}" title="${file.included === false ? 'Add to AI context' : 'Used as AI context'}">
        ${phIcon(file.included === false ? 'circle' : 'check-circle')}
        <span>${escapeHtml(file.name)}</span>
        <small>${formatFileSize(file.size)}</small>
      </button>
      <button class="chat-file-remove" data-conversation-file-delete="${file.id}" aria-label="Delete ${escapeHtml(file.name)}">${phIcon('x')}</button>
    </div>
  `).join('');
}

function renderComposer({ project = false } = {}) {
  const hasCommands = Boolean(state.promptCommands?.length);
  const hasFiles = Boolean(conversationFiles().length);
  return `
    <div class="composer ${project ? 'project-composer' : ''} ${hasCommands || hasFiles ? 'has-prompt-commands' : ''}">
      <div class="slash-command-menu" id="slash-command-menu" role="listbox" aria-label="Skill and tool commands" hidden></div>
      ${hasCommands ? `<div class="prompt-command-chips">${renderPromptCommandChips()}</div>` : ''}
      ${hasFiles ? `<div class="chat-file-chips">${renderConversationFileChips()}</div>` : ''}
      ${state.conversationFileError ? `<div class="composer-file-error">${escapeHtml(state.conversationFileError)}</div>` : ''}
      <textarea id="prompt-input" placeholder="${project ? 'Type / for skills and tools' : 'How can I help you today? Type / for commands'}" ${state.isSending ? 'disabled' : ''}>${escapeHtml(state.promptDraft || '')}</textarea>
      <div class="composer-controls">
        <button class="icon-button" data-action="upload-chat-files" aria-label="Upload files">${phIcon('plus')}</button>
        <input class="chat-file-upload-input" type="file" multiple accept=".md,.txt,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css,.xml,.yaml,.yml,text/*,application/json" aria-label="Upload conversation context files" />
        <div class="composer-options">
          <select id="model-select" aria-label="Choose model">
            ${defaultModels.map((model) => `<option value="${model.id}" ${model.id === currentModelId() ? 'selected' : ''}>${escapeHtml(model.label)}</option>`).join('')}
          </select>
          <select id="tone-select" aria-label="Choose thinking intensity">
            ${toneOptions.map((tone) => `<option ${tone === state.tone ? 'selected' : ''}>${tone}</option>`).join('')}
          </select>
          <button class="icon-button" data-quick="Transcribe my voice:" aria-label="Voice">${phIcon('microphone')}</button>
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
          <div class="messages" id="messages">${renderMessages()}${state.isSending ? '<div class="typing">Claude is thinking...</div>' : ''}</div>
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
            <button data-quick="Build a strategy for:">${icon('monitoring')}<span>Strategize</span></button>
            <button data-quick="Write code for:">${icon('code')}<span>Code</span></button>
            <button data-quick="Teach me about:">${icon('school')}<span>Learn</span></button>
            <button data-quick="Help me write:">${icon('edit')}<span>Write</span></button>
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
    : '<p class="empty-copy">No chats in this project yet.</p>';
  const instruction = projectInstruction(project);
  const projectFileList = projectFiles(project.id);
  const availableFileIds = new Set(projectFileList.map((file) => file.id));
  const selectedFileIds = new Set((state.selectedProjectFileIds || []).filter((id) => availableFileIds.has(id)));
  const selectedCount = selectedFileIds.size;
  const allFilesSelected = Boolean(projectFileList.length)
    && projectFileList.every((file) => selectedFileIds.has(file.id));
  const selectionToolbar = selectedCount ? `
    <div class="project-file-selection-toolbar">
      <button class="project-file-select-all ${allFilesSelected ? 'selected' : ''}" data-action="toggle-all-project-files" aria-label="${allFilesSelected ? 'Deselect all files' : 'Select all files'}" aria-pressed="${allFilesSelected}">
        ${allFilesSelected ? phIcon('check') : ''}
      </button>
      <span>${selectedCount} selected</span>
      <button class="project-file-bulk-delete" data-action="delete-selected-project-files" aria-label="Delete selected files">${phIcon('trash')}</button>
      <button class="project-file-selection-close" data-action="clear-project-file-selection" aria-label="Close file selection">${phIcon('x')}</button>
    </div>
  ` : '';
  const files = projectFileList.map((file) => {
    const selected = selectedFileIds.has(file.id);
    return `
      <article class="project-file ${selected ? 'selected' : ''}">
        <button class="project-file-delete" data-project-file-delete="${file.id}" aria-label="Delete ${escapeHtml(file.name)}">${phIcon('x')}</button>
        <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
        <small>${formatLineCount(file.lineCount)} lines</small>
        <b>${escapeHtml(projectFileExtension(file.name).toUpperCase() || 'FILE')}</b>
        <button class="project-file-select ${selected ? 'selected' : ''}" data-project-file-select="${file.id}" aria-label="${selected ? 'Deselect' : 'Select'} ${escapeHtml(file.name)}" aria-pressed="${selected}">
          ${selected ? phIcon('check') : ''}
        </button>
      </article>
    `;
  }).join('');
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
          <section class="context-card files-context ${selectedCount ? 'selection-active' : ''}">
            <div class="context-card-heading"><h2>Files</h2><button class="icon-button" data-action="upload-project-files" aria-label="Upload project files">${icon('add')}</button></div>
            ${state.projectFileError ? `<div class="project-file-error">${phIcon('warning-circle')}<span>${escapeHtml(state.projectFileError)}</span></div>` : ''}
            ${selectionToolbar}
            <div class="project-files">${files || '<p class="empty-copy">No files yet.</p>'}</div>
            <input class="project-file-upload-input" type="file" multiple accept=".md,.txt,.json,.csv,.js,.jsx,.ts,.tsx,.html,.css,.xml,.yaml,.yml,text/*,application/json" aria-label="Upload project context files" />
          </section>
        </aside>
      </div>
    </main>
  `;
}

function formatConnectorCheckTime(value) {
  if (!value) return 'Not tested';
  return new Intl.DateTimeFormat('en-US', {
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
          <p>Connect Atlassian so chat can search, read, and update Jira and Confluence.</p>
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
            <p>One secure connection for Jira and Confluence Cloud.</p>
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
              <p>${phIcon('shield-check')} Tokens are stored only in server process memory and never in browser storage.</p>
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
        <p>Both tools use the same Atlassian account.</p>
      </div>
      <div class="connector-products">
        ${renderConnectorProduct({
          iconName: 'check-square-offset',
          name: 'Jira',
          description: 'Search issues, read ticket details, create issues, update fields, and add comments.',
          capabilities: ['Search & read', 'Create & update', 'Add comments'],
        })}
        ${renderConnectorProduct({
          iconName: 'files',
          name: 'Confluence',
          description: 'Search pages, read workspace content, and update pages with explicit instructions.',
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
            <p>These instructions are always applied to chats in ${escapeHtml(project.name)}.</p>
          </div>
          <button data-action="close-project-instructions" aria-label="Close project instructions">${phIcon('x')}</button>
        </header>
        <label>
          <span>Instructions</span>
          <textarea id="project-instruction-editor" placeholder="Example: Use Bahasa Indonesia, focus on B2B edtech, and target schools and bootcamps.">${escapeHtml(projectInstruction(project))}</textarea>
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

function renderApiKeySettings() {
  return modelKeyFamilies.map((family) => {
    const rows = apiKeyInputsForFamily(family.id);
    const configuredCount = apiKeysForFamily(family.id).length;
    return `
      <section class="api-key-family">
        <header class="api-key-family-header">
          <span>
            <strong>${escapeHtml(family.label)}</strong>
            <small>${escapeHtml(family.detail)}</small>
          </span>
          <em>${configuredCount} key</em>
        </header>
        <div class="api-key-list">
          ${rows.map((key, index) => `
            <div class="api-key-row">
              <input
                class="api-key-input"
                type="password"
                placeholder="sk-ant-..."
                value="${escapeHtml(key)}"
                data-api-key-family="${family.id}"
                data-api-key-index="${index}"
                aria-label="API key ${escapeHtml(family.label)} ${index + 1}"
              />
              <button
                class="icon-button api-key-remove"
                data-api-key-remove="${family.id}:${index}"
                aria-label="Remove API key ${escapeHtml(family.label)} ${index + 1}"
                ${rows.length === 1 && !key ? 'disabled' : ''}
              >${phIcon('x')}</button>
            </div>
          `).join('')}
        </div>
        <button class="api-key-add" data-api-key-add="${family.id}">${phIcon('plus')} Add ${escapeHtml(family.label)} key</button>
      </section>
    `;
  }).join('');
}

function renderSettingsContent() {
  return `
    <section class="settings-content">
      <h2>Profile</h2>
      <div class="settings-row"><label>Avatar</label><span class="large-avatar">N</span></div>
      <div class="settings-row"><label for="profile-full-name">Full name</label><input id="profile-full-name" value="${escapeHtml(state.profile.fullName)}" /></div>
      <div class="settings-row"><label for="profile-call-name">What should Claude call you?</label><input id="profile-call-name" value="${escapeHtml(state.profile.callName)}" /></div>
      <div class="settings-row"><label for="profile-work">What best describes your work?</label><select id="profile-work"><option value="">Select</option><option ${state.profile.work === 'Research' ? 'selected' : ''}>Research</option><option ${state.profile.work === 'Engineering' ? 'selected' : ''}>Engineering</option><option ${state.profile.work === 'Founder' ? 'selected' : ''}>Founder</option></select></div>
      <div class="settings-section-block">
        <h3>API keys per model</h3>
        <p>The local proxy uses keys for the active model. If the first key fails, the server automatically tries the next key in the same model family.</p>
        <div class="api-key-settings">${renderApiKeySettings()}</div>
        <small>Keys are saved automatically in the local backend <code>data/store.json</code>, not in browser localStorage.</small>
      </div>
      <div class="settings-section-block">
        <h3>Global memory</h3>
        <p>Cross-session preferences. This memory is not shown on project pages.</p>
        <button class="global-memory-card" data-action="open-global-memory">
          <span><strong>Manage global memory</strong><small>${escapeHtml(state.globalMemory || 'No global memory yet.')}</small></span>
          <span><small>Last updated: ${escapeHtml(formatMemoryTime(state.memoryUpdatedAt?.global))}</small>${icon('arrow_forward')}</span>
        </button>
      </div>
      <div class="settings-save-row">
        <button data-action="save-settings" class="primary-dark">Save changes</button>
      </div>
    </section>
  `;
}

function renderSettingsModal() {
  if (!state.settingsOpen) return '';
  const items = [
    ['general', 'settings', 'General'],
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
  const title = isGlobal ? 'Manage memory' : 'Manage project memory';
  const description = isGlobal
    ? 'Here is what Claude remembers about you. This summary is regenerated each night and does not include projects, which have their own specific memory.'
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
        <div class="memory-document-frame ${state.memoryModalEditing ? 'editing-request' : ''}">
          <article class="memory-document">${renderMemoryDocument(memory)}</article>
          ${state.memoryModalEditing ? '' : `<button class="memory-edit-fab" data-action="edit-memory-modal" aria-label="Edit ${isGlobal ? 'global' : 'project'} memory">${phIcon('pencil-simple')}</button>`}
          ${state.memoryModalEditing ? `
            <div class="memory-instruction-composer">
              <textarea id="memory-edit-input" rows="1" placeholder="Tell Claude what to remember or forget..." aria-label="Tell Claude what to remember or forget">${escapeHtml(state.memoryEditDraft || '')}</textarea>
              <button data-action="submit-memory-edit" aria-label="Submit memory update" ${state.isMemoryUpdating || !state.memoryEditDraft ? 'disabled' : ''}>
                ${state.isMemoryUpdating ? phIcon('spinner-gap', 'spin') : phIcon('arrow-right')}
              </button>
            </div>
          ` : ''}
        </div>
        ${state.memoryModalError ? `<div class="memory-modal-error">${phIcon('warning-circle')}<span>${escapeHtml(state.memoryModalError)}</span></div>` : ''}
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

async function openProjectDetail(projectId) {
  state.activeProject = projectId;
  state.view = 'project';
  state.projectMemoryEditing = false;
  state.projectFileError = '';
  state.selectedProjectFileIds = [];
  saveState();
  render();
  try {
    await loadProjectFiles(projectId);
  } catch (error) {
    setState({ projectFileError: error.message || 'Failed to load project files.' }, false);
  }
}

async function openConversation(conversationId) {
  const conversation = conversationById(conversationId);
  state.activeConversation = conversationId;
  state.activeProject = conversation?.projectId ?? null;
  state.view = 'chat';
  state.conversationFileError = '';
  saveState();
  render();
  try {
    await loadConversationFiles(conversationId);
  } catch (error) {
    setState({ conversationFileError: error.message || 'Failed to load session files.' }, false);
  }
}

function createProjectConversation(projectId) {
  const id = nextConversationId();
  const project = projectById(projectId);
  state.conversations = [{
    id,
    title: 'Untitled',
    projectId,
    model: currentModelId(),
    preview: 'New project session',
    updated: 'Just now',
  }, ...state.conversations];
  state.messagesByConversation = {
    ...state.messagesByConversation,
    [id]: [{ ...welcomeMessage, id: crypto.randomUUID(), text: `${project?.name || 'Project'} is active.` }],
  };
  state.conversationFiles = { ...(state.conversationFiles || {}), [id]: [] };
  state.activeConversation = id;
}

function openConversationFilePicker() {
  if (state.view === 'project' && currentConversation()?.projectId !== state.activeProject) {
    createProjectConversation(state.activeProject);
    saveState();
    render();
  }
  document.querySelector('.chat-file-upload-input')?.click();
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
  const projectFileSelectButton = event.target.closest('[data-project-file-select]');
  const projectFileDeleteButton = event.target.closest('[data-project-file-delete]');
  const conversationFileToggleButton = event.target.closest('[data-conversation-file-toggle]');
  const conversationFileDeleteButton = event.target.closest('[data-conversation-file-delete]');
  const apiKeyAddButton = event.target.closest('[data-api-key-add]');
  const apiKeyRemoveButton = event.target.closest('[data-api-key-remove]');

  if (apiKeyAddButton) return addApiKeyRow(apiKeyAddButton.dataset.apiKeyAdd);
  if (apiKeyRemoveButton) {
    const [familyId, index] = apiKeyRemoveButton.dataset.apiKeyRemove.split(':');
    return removeApiKeyRow(familyId, index);
  }
  if (conversationFileDeleteButton) return removeConversationFile(conversationFileDeleteButton.dataset.conversationFileDelete);
  if (conversationFileToggleButton) return toggleConversationFileContext(conversationFileToggleButton.dataset.conversationFileToggle);
  if (projectFileDeleteButton) return removeProjectFile(projectFileDeleteButton.dataset.projectFileDelete);
  if (projectFileSelectButton) return toggleProjectFileSelection(projectFileSelectButton.dataset.projectFileSelect);
  if (branchMessageButton) return branchConversation(branchMessageButton.dataset.branchMessage);
  if (conversationButton) {
    const activeConversation = Number(conversationButton.dataset.conversation);
    return openConversation(activeConversation);
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
  if (action === 'toggle-all-project-files') toggleAllProjectFileSelection();
  if (action === 'delete-selected-project-files') removeSelectedProjectFiles();
  if (action === 'clear-project-file-selection') clearProjectFileSelection();
  if (action === 'upload-chat-files') openConversationFilePicker();
  if (action === 'open-global-memory') openMemoryModal('global');
  if (action === 'close-memory-modal') closeMemoryModal();
  if (action === 'edit-memory-modal') startMemoryModalEditing();
  if (action === 'submit-memory-edit') submitMemoryEdit();
  if (action === 'toggle-sidebar') setState({ sidebarCollapsed: !state.sidebarCollapsed });
  if (action === 'focus-search') document.querySelector('#project-search, .settings-search input')?.focus();
  if (action === 'new-project') createNewProject();
  if (action === 'save-settings') saveSettings();
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
  if (event.target.matches('.chat-file-upload-input')) {
    importConversationFiles(event.target.files);
    event.target.value = '';
    return;
  }
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
  if (event.target.id === 'memory-edit-input') {
    state.memoryEditDraft = event.target.value;
    syncMemoryEditSubmitState();
  }
  if (event.target.closest('.skill-modal-fields')) updateSkillModalSubmitState();
  if (event.target.dataset.apiKeyFamily) {
    setApiKeyValue(event.target.dataset.apiKeyFamily, event.target.dataset.apiKeyIndex, event.target.value);
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
  if (event.target.id === 'memory-edit-input' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitMemoryEdit();
    return;
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

async function initializeFileStorage() {
  try {
    for (const legacyFile of pendingLegacyProjectFiles) {
      const upload = new File([legacyFile.content], legacyFile.name, {
        type: legacyFile.type || 'text/plain',
        lastModified: Date.parse(legacyFile.addedAt) || Date.now(),
      });
      await uploadStoredFile(upload, 'project', legacyFile.projectId);
    }

    const projectEntries = await Promise.all(allProjects().map(async (project) => (
      [project.id, await listStoredFiles('project', project.id)]
    )));
    state.projectFiles = Object.fromEntries(projectEntries);
    state.conversationFiles = {
      ...(state.conversationFiles || {}),
      [state.activeConversation]: await listStoredFiles('conversation', state.activeConversation),
    };
    state.backendFilesMigrated = true;
    pendingLegacyProjectFiles.splice(0);
    state.projectFileError = '';
    state.conversationFileError = '';
    saveState();
    render();
  } catch (error) {
    state.error = `Backend file storage could not be loaded: ${error.message}`;
    render();
  }
}

async function initializeBackendState() {
  const browserMigrationState = structuredClone(state);
  const hasBrowserMigration = Boolean(localStorage.getItem(STORAGE_KEY));
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to load backend state.');

    if (payload.state) {
      state = normalizePersistedState(payload.state);
    } else if (hasBrowserMigration) {
      state = browserMigrationState;
    } else {
      state = normalizePersistedState(initialState);
    }

    prepareLoadedStateFiles();
    backendStateLoaded = true;
    pendingPersistedState = buildPersistedState();
    await flushStateSave();
    localStorage.removeItem(STORAGE_KEY);
    render();
    await initializeFileStorage();
    if (state.view === 'customize' && state.customizeSection === 'connectors') loadAtlassianConnectorStatus();
  } catch (error) {
    backendStateLoaded = false;
    state.error = error.message || 'Backend state could not be loaded.';
    render();
  }
}

window.addEventListener('beforeunload', () => {
  if (!backendStateLoaded) return;
  const payload = JSON.stringify({ state: pendingPersistedState || buildPersistedState() });
  const body = new Blob([payload], { type: 'application/json' });
  navigator.sendBeacon?.('/api/state', body);
});

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
initializeBackendState();
