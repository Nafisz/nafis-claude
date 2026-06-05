const STORAGE_KEY = 'nafisClaudeWorkspace:v2';

const defaultModels = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', detail: 'Seimbang untuk kerja harian dan reasoning.' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', detail: 'Reasoning paling mendalam.' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', detail: 'Cepat dan hemat.' },
];

const defaultSkills = [
  { id: 'confluence', name: 'Confluence', active: false, description: 'Cari halaman, baca ruang kerja, dan rangkum dokumen internal jika konektor tersedia.' },
  { id: 'generate-file', name: 'Generate File', active: true, description: 'Membuat dokumen, kode, dan artefak sebagai file yang bisa dibuka/diunduh.' },
  { id: 'product-analysis', name: 'Analisis Produk', active: true, description: 'Menyusun PRD, roadmap, metrik, dan riset kompetitor.' },
  { id: 'ui-design', name: 'Desain UI', active: true, description: 'Memberi kritik visual dan menghasilkan spesifikasi antarmuka.' },
];

const defaultProjects = [
  {
    id: 'nova',
    name: 'NovaX Edtech',
    memory: 'Gunakan Bahasa Indonesia, fokus pada edtech B2B, target sekolah dan bootcamp.',
    color: 'apricot',
  },
  {
    id: 'game',
    name: 'AI Game Lab',
    memory: 'Preferensi: prototype cepat, agent NPC, Godot/Unity ringan, gameplay dulu baru visual.',
    color: 'sage',
  },
  {
    id: 'ops',
    name: 'Operasional Pribadi',
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
  model: defaultModels[0].id,
  tone: 'Sedang',
  apiKey: '',
  apiKeySaved: false,
  activeProject: null,
  activeConversation: 1,
  activeArtifact: null,
  showSkills: true,
  isSending: false,
  error: '',
  conversations: [
    { id: 1, title: 'Tanpa judul', projectId: null, preview: 'Sesi umum di luar Project', updated: 'Baru saja' },
    { id: 2, title: 'AI game sederhana vs LLM untuk NPC', projectId: 'game', preview: 'Eksperimen gameplay dan prompt', updated: '2 jam lalu' },
    { id: 3, title: 'Perbedaan Claude di app vs API usage', projectId: null, preview: 'Catatan umum lintas proyek', updated: 'Kemarin' },
    { id: 4, title: 'Desain arsitektur yang sudah siap MVP', projectId: 'nova', preview: 'Backend, auth, dan billing', updated: 'Senin' },
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
      error: '',
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
    error: '',
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
  return defaultModels.find((model) => model.id === id) ?? defaultModels[0];
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

function activeMemory() {
  const conversationProject = projectById(currentConversation()?.projectId);
  const selectedProject = projectById(state.activeProject);
  return selectedProject ?? conversationProject;
}

function activeSkills() {
  return defaultSkills.map((skill) => ({ ...skill, ...(state.skills?.find((item) => item.id === skill.id) || {}) }));
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
    };
  });
}

function detectActions(prompt, assistantText = '') {
  const lowerPrompt = prompt.toLowerCase();
  const skills = activeSkills();
  const actions = [];

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

function createLocalFallback(prompt) {
  const memory = activeMemory();
  const actions = detectActions(prompt);
  const text = [
    'Mode lokal aktif karena API key belum tersedia atau request gagal.',
    memory ? `Memori Project yang dipakai: ${memory.name} — ${memory.memory}` : 'Sesi ini berjalan di luar Project.',
    'Setelah API key Claude dipasang, jawaban akan datang dari backend proxy `/api/chat` dan model Claude yang dipilih.',
  ].join('\n\n');
  return { text, actions };
}

async function requestClaude(prompt) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiKey: state.apiKey,
      model: state.model,
      tone: state.tone,
      project: activeMemory(),
      skills: activeSkills(),
      messages: currentMessages().concat({ role: 'user', text: prompt }),
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Claude API gagal merespons.');
  }

  return {
    text: payload.text || 'Claude merespons tanpa teks.',
    usage: payload.usage,
    model: payload.model,
    actions: detectActions(prompt, payload.text),
  };
}

async function addMessage() {
  const input = document.querySelector('#prompt-input');
  const prompt = input.value.trim();
  if (!prompt || state.isSending) return;

  const userMessage = { id: crypto.randomUUID(), role: 'user', text: prompt, createdAt: new Date().toISOString() };
  state.messagesByConversation[state.activeConversation] = currentMessages().concat(userMessage);
  updateConversationPreview(prompt);
  state.isSending = true;
  state.error = '';
  saveState();
  render();

  let reply;
  try {
    reply = await requestClaude(prompt);
  } catch (error) {
    reply = createLocalFallback(prompt);
    state.error = error.message;
  }

  const assistantMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: reply.text,
    actions: reply.actions,
    usage: reply.usage,
    model: reply.model,
    createdAt: new Date().toISOString(),
  };
  const newArtifacts = reply.actions
    .filter((action) => action.type === 'file')
    .map((action) => createArtifactFromAction(action, reply.text));

  state.messagesByConversation[state.activeConversation] = currentMessages().concat(assistantMessage);
  state.artifacts = [...newArtifacts, ...state.artifacts];
  state.activeArtifact = newArtifacts[0]?.id ?? state.activeArtifact;
  state.isSending = false;
  saveState();
  render();
}

function newConversation() {
  const id = Date.now();
  state.conversations = [{ id, title: 'Tanpa judul', projectId: state.activeProject, preview: 'Sesi baru', updated: 'Baru saja' }, ...state.conversations];
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
                ${defaultModels.map((model) => `<option value="${model.id}" ${model.id === state.model ? 'selected' : ''}>${escapeHtml(model.label)}</option>`).join('')}
              </select>
              <select id="tone-select" aria-label="Pilih intensitas berpikir">
                ${['Rendah', 'Sedang', 'Tinggi'].map((tone) => `<option ${tone === state.tone ? 'selected' : ''}>${tone}</option>`).join('')}
              </select>
              <button title="Voice" data-quick="Transkrip voice saya:">🎙</button><button id="send-button" class="send-button" ${state.isSending ? 'disabled' : ''}>↵</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderInspector() {
  const skillRows = activeSkills().map((skill) => `
    <label class="skill-row">
      <input type="checkbox" data-skill="${skill.id}" ${skill.active ? 'checked' : ''} />
      <span><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.description)}</small></span>
    </label>
  `).join('');

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
      <div class="inspector-card">
        <div class="panel-heading"><p>Model</p><strong>${escapeHtml(modelById(state.model).label)}</strong><small>${escapeHtml(modelById(state.model).detail)}</small></div>
      </div>
      <div class="inspector-card">
        <div class="panel-heading"><p>Skills</p><strong>LLM-aware tools</strong><small>Skill aktif dikirim ke backend sebagai konteks dan guardrail.</small></div>
        ${skillRows}
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

  if (!actionButton) return;

  const action = actionButton.dataset.action;
  if (action === 'new-chat') newConversation();
  if (action === 'toggle-skills') setState({ showSkills: !state.showSkills });
  if (action === 'show-projects') document.querySelector('#project-rail')?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'show-artifacts') document.querySelector('#artifact-panel')?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'show-chats') document.querySelector('#recent-list')?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'focus-prompt') focusPrompt();
  if (action === 'add-skill') setState({ error: 'Tambah skill kustom belum dibuat; aktifkan/nonaktifkan skill yang tersedia dulu.' }, false);
}

function handleChange(event) {
  if (event.target.id === 'model-select') setState({ model: event.target.value });
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
