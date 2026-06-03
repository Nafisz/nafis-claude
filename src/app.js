const models = [
  { name: 'Sonnet 4.6', detail: 'Seimbang untuk kerja harian' },
  { name: 'Opus 4.1', detail: 'Reasoning mendalam' },
  { name: 'Haiku 4.5', detail: 'Cepat dan hemat' },
  { name: 'GPT-5.3-Codex', detail: 'Coding agentic' },
];

const skills = [
  { name: 'Confluence', active: true, description: 'Cari halaman, baca ruang kerja, dan rangkum dokumen internal.' },
  { name: 'Generate File', active: true, description: 'Membuat dokumen, kode, dan artefak sebagai file nyata.' },
  { name: 'Analisis Produk', active: true, description: 'Menyusun PRD, roadmap, metrik, dan riset kompetitor.' },
  { name: 'Desain UI', active: false, description: 'Memberi kritik visual dan menghasilkan spesifikasi antarmuka.' },
];

const conversations = [
  { id: 1, title: 'Tanpa judul', projectId: null, preview: 'Sesi umum di luar Project', updated: 'Baru saja' },
  { id: 2, title: 'AI game sederhana vs LLM untuk NPC', projectId: 'game', preview: 'Eksperimen gameplay dan prompt', updated: '2 jam lalu' },
  { id: 3, title: 'Perbedaan Claude di app vs API usage', projectId: null, preview: 'Catatan umum lintas proyek', updated: 'Kemarin' },
  { id: 4, title: 'Desain arsitektur yang sudah siap MVP', projectId: 'nova', preview: 'Backend, auth, dan billing', updated: 'Senin' },
];

const projects = [
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

let state = {
  model: models[0].name,
  tone: 'Rendah',
  activeProject: null,
  activeConversation: 1,
  showSkills: false,
  showProjects: true,
  messages: [
    {
      role: 'assistant',
      text: 'Malam, siffan. Obrolan ini bisa berjalan sebagai sesi umum atau dimasukkan ke Project folder dengan memori sendiri.',
    },
  ],
  artifacts: [
    { type: 'doc', name: 'brief-proyek.md', detail: 'Contoh file yang dapat dibuat otomatis oleh LLM.' },
  ],
};

const app = document.querySelector('#app');

function projectById(id) {
  return projects.find((project) => project.id === id) ?? null;
}

function currentConversation() {
  return conversations.find((conversation) => conversation.id === state.activeConversation) ?? conversations[0];
}

function activeMemory() {
  const conversationProject = projectById(currentConversation().projectId);
  const selectedProject = projectById(state.activeProject);
  return selectedProject ?? conversationProject;
}

function organicAgentReply(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const actions = [];
  let text = 'Siap. Saya menangkap instruksi itu sebagai pekerjaan LLM langsung, bukan fitur terpisah.';

  if (lowerPrompt.includes('confluence') || lowerPrompt.includes('di confluence')) {
    actions.push({ type: 'tool', name: 'Confluence search', detail: 'Mencari halaman relevan lalu membaca hasil teratas.' });
    text = 'Saya akan mencari konteks di Confluence secara otomatis karena kamu menyebut “di Confluence”.';
  }

  if (lowerPrompt.includes('generate') || lowerPrompt.includes('buat file') || lowerPrompt.includes('hasilkan file')) {
    actions.push({ type: 'file', name: 'generated-output.md', detail: 'File dibuat dari instruksi percakapan.' });
    text = 'Saya membuat file dari permintaanmu dan menaruhnya sebagai artefak percakapan.';
  }

  if (lowerPrompt.includes('project') || lowerPrompt.includes('memori')) {
    text = 'Sesi ini bisa tetap di luar Project, atau dipindahkan ke Project folder yang punya memori sendiri seperti Claude.';
  }

  return { text, actions };
}

function addMessage() {
  const input = document.querySelector('#prompt-input');
  const prompt = input.value.trim();
  if (!prompt) return;

  state.messages.push({ role: 'user', text: prompt });
  const reply = organicAgentReply(prompt);
  state.messages.push({ role: 'assistant', text: reply.text, actions: reply.actions });
  state.artifacts = [...reply.actions.filter((action) => action.type === 'file'), ...state.artifacts];
  input.value = '';
  render();
}

function renderSidebar() {
  const recentItems = conversations.map((conversation) => {
    const project = projectById(conversation.projectId);
    const active = conversation.id === state.activeConversation ? 'active' : '';
    return `
      <button class="recent-item ${active}" data-conversation="${conversation.id}">
        <span>${conversation.title}</span>
        <small>${project ? project.name : 'Di luar Project'} • ${conversation.updated}</small>
      </button>
    `;
  }).join('');

  return `
    <aside class="sidebar">
      <div class="brand-row">
        <div class="brand">Claude</div>
        <div class="icon-row"><button aria-label="Cari">⌕</button><button aria-label="Panel">◧</button></div>
      </div>

      <nav class="primary-nav" aria-label="Navigasi utama">
        <button class="nav-item strong"><span>＋</span> Chat baru</button>
        <button class="nav-item"><span>☏</span> Obrolan</button>
        <button class="nav-item"><span>▣</span> Proyek</button>
        <button class="nav-item"><span>◇</span> Artefak</button>
        <button class="nav-item" id="toggle-skills"><span>▤</span> Sesuaikan</button>
      </nav>

      <div class="sidebar-section">
        <p>Produk</p>
        <button class="nav-item"><span>☷</span> Cowork</button>
        <button class="nav-item"><span>&lt;/&gt;</span> Kode</button>
      </div>

      <div class="sidebar-section recents">
        <div class="section-title"><p>Terbaru</p><button title="Filter">⌘</button></div>
        ${recentItems}
      </div>
    </aside>
  `;
}

function renderProjectRail() {
  const rows = projects.map((project) => {
    const count = conversations.filter((conversation) => conversation.projectId === project.id).length;
    const active = state.activeProject === project.id ? 'selected' : '';
    return `
      <button class="project-card ${active}" data-project="${project.id}">
        <span class="project-dot ${project.color}"></span>
        <span><strong>${project.name}</strong><small>${count} sesi • memori khusus</small></span>
      </button>
    `;
  }).join('');

  return `
    <section class="project-rail ${state.showProjects ? '' : 'collapsed'}">
      <div class="rail-header">
        <div>
          <p>Project folders</p>
          <h2>Memori per folder</h2>
        </div>
        <button id="clear-project">Umum</button>
      </div>
      <button class="project-card ${state.activeProject === null ? 'selected' : ''}" data-project="outside">
        <span class="project-dot neutral"></span>
        <span><strong>Di luar Project</strong><small>Sesi bebas tanpa memori folder</small></span>
      </button>
      ${rows}
      <div class="memory-card">
        <p>Memori aktif</p>
        <strong>${activeMemory()?.name ?? 'Sesi umum'}</strong>
        <span>${activeMemory()?.memory ?? 'Tidak memakai memori Project. Cocok untuk percakapan lintas topik.'}</span>
      </div>
    </section>
  `;
}

function renderChat() {
  const memory = activeMemory();
  const messages = state.messages.map((message) => `
    <article class="message ${message.role}">
      <div class="avatar">${message.role === 'assistant' ? '✺' : 'S'}</div>
      <div class="bubble">
        <p>${message.text}</p>
        ${(message.actions ?? []).map((action) => `
          <div class="organic-action ${action.type}">
            <span>${action.type === 'tool' ? '🔧' : '📄'}</span>
            <div><strong>${action.name}</strong><small>${action.detail}</small></div>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('');

  return `
    <main class="workspace">
      <header class="topbar">
        <div class="plan-pill">Paket gratis · <span>Tingkatkan</span></div>
        <button class="ghost-button">👻</button>
      </header>

      <section class="hero">
        <div class="claude-mark">✺</div>
        <h1>Malam, siffan</h1>
        <p>${memory ? `Menggunakan memori Project “${memory.name}”.` : 'Sesi ini berada di luar Project dan tetap mandiri.'}</p>
      </section>

      <section class="chat-card" aria-label="Area percakapan">
        <div class="messages">${messages}</div>
        <div class="composer">
          <textarea id="prompt-input" placeholder="Apa yang bisa saya bantu hari ini? Coba: ‘buat file roadmap.md’ atau ‘cari di Confluence’"></textarea>
          <div class="composer-footer">
            <div class="quick-actions">
              <button>Riset</button><button>&lt;/&gt; Kode</button><button>✎ Tulis</button><button>▱ Belajar</button><button>☕ Urusan pribadi</button>
            </div>
            <div class="model-controls">
              <select id="model-select" aria-label="Pilih model">
                ${models.map((model) => `<option ${model.name === state.model ? 'selected' : ''}>${model.name}</option>`).join('')}
              </select>
              <select id="tone-select" aria-label="Pilih intensitas berpikir">
                ${['Rendah', 'Sedang', 'Tinggi'].map((tone) => `<option ${tone === state.tone ? 'selected' : ''}>${tone}</option>`).join('')}
              </select>
              <button title="Voice">🎙</button><button id="send-button" class="send-button">↵</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderInspector() {
  const skillRows = skills.map((skill) => `
    <label class="skill-row">
      <input type="checkbox" ${skill.active ? 'checked' : ''} />
      <span><strong>${skill.name}</strong><small>${skill.description}</small></span>
    </label>
  `).join('');

  const artifactRows = state.artifacts.map((artifact) => `
    <div class="artifact-row">
      <span>${artifact.type === 'file' ? '📄' : '📝'}</span>
      <div><strong>${artifact.name}</strong><small>${artifact.detail}</small></div>
    </div>
  `).join('');

  return `
    <aside class="inspector ${state.showSkills ? 'open' : ''}">
      <div class="inspector-card">
        <div class="panel-heading"><p>Model</p><strong>${state.model}</strong><small>${models.find((model) => model.name === state.model)?.detail}</small></div>
      </div>
      <div class="inspector-card">
        <div class="panel-heading"><p>Skills</p><strong>LLM-aware tools</strong><small>Skill aktif dipanggil organik dari bahasa natural.</small></div>
        ${skillRows}
        <button class="add-skill">＋ Tambahkan skill</button>
      </div>
      <div class="inspector-card">
        <div class="panel-heading"><p>Artefak</p><strong>File yang dihasilkan</strong></div>
        ${artifactRows}
      </div>
    </aside>
  `;
}

function bindEvents() {
  document.querySelectorAll('[data-conversation]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeConversation = Number(button.dataset.conversation);
      state.activeProject = currentConversation().projectId;
      render();
    });
  });

  document.querySelectorAll('[data-project]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeProject = button.dataset.project === 'outside' ? null : button.dataset.project;
      render();
    });
  });

  document.querySelector('#toggle-skills')?.addEventListener('click', () => {
    state.showSkills = !state.showSkills;
    render();
  });

  document.querySelector('#clear-project')?.addEventListener('click', () => {
    state.activeProject = null;
    render();
  });

  document.querySelector('#model-select')?.addEventListener('change', (event) => {
    state.model = event.target.value;
    render();
  });

  document.querySelector('#tone-select')?.addEventListener('change', (event) => {
    state.tone = event.target.value;
    render();
  });

  document.querySelector('#send-button')?.addEventListener('click', addMessage);
  document.querySelector('#prompt-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addMessage();
    }
  });
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
  bindEvents();
}

render();
