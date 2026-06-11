const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOOL_LOOPS = 4;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const ERROR_MESSAGES = {
  400: 'Request error — context mungkin terlalu panjang.',
  401: 'API key invalid.',
  429: 'Rate limit hit. Tunggu sebentar.',
  500: 'Anthropic server error.',
  529: 'Claude sedang overloaded. Coba lagi sebentar.',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error('Request terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((block) => block?.type === 'text').map((block) => block.text || '').join('\n\n');
}

function normalizeMessages(messages = []) {
  const clean = messages
    .filter((message) => ['user', 'assistant'].includes(message.role))
    .map((message) => {
      const content = message.content ?? message.text ?? '';
      return { role: message.role, content: Array.isArray(content) ? content : String(content || '').trim() };
    })
    .filter((message) => Array.isArray(message.content) ? message.content.length : message.content);

  while (clean.length && clean[0].role !== 'user') clean.shift();

  return clean.reduce((acc, message) => {
    const previous = acc[acc.length - 1];
    if (previous?.role === message.role && typeof previous.content === 'string' && typeof message.content === 'string') {
      previous.content += `\n\n${message.content}`;
    } else {
      acc.push({ ...message });
    }
    return acc;
  }, []);
}

function triggerMatches(text, keywords = []) {
  const lower = String(text || '').toLowerCase();
  return keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()));
}

function formatMemoryBlock(globalMemory) {
  const memoryText = Array.isArray(globalMemory)
    ? globalMemory.map((item) => item?.content || item).filter(Boolean).map((item) => `- ${item}`).join('\n')
    : String(globalMemory || '').trim();
  return memoryText ? `<memory>\n${memoryText}\n</memory>` : '';
}

function buildSystemPrompt({ project, skills, tone, globalMemory, sessionSummary, contextMeta, lastUserMessage }) {
  const memoryBlock = formatMemoryBlock(globalMemory);
  const projectPrompt = project ? [project.systemPrompt || project.memory || '', project.generatedMemory || ''].filter(Boolean).join('\n\n') : '';
  const triggeredSkills = (skills || [])
    .filter((skill) => skill.active)
    .filter((skill) => !skill.triggerKeywords?.length || triggerMatches(lastUserMessage, skill.triggerKeywords))
    .map((skill) => `## Skill: ${skill.name}\n${skill.content || skill.systemPromptFragment || skill.description || ''}`)
    .join('\n\n');

  return [
    memoryBlock,
    'Kamu adalah asisten chat yang mengikuti pola Claude: jelas, tenang, aman, dan langsung membantu.',
    'Jawab dalam Bahasa Indonesia kecuali pengguna meminta bahasa lain.',
    `Intensitas berpikir: ${tone || 'Sedang'}.`,
    projectPrompt ? `## Project Instructions\n${projectPrompt}` : '',
    sessionSummary ? `## Session Summary\n${sessionSummary}` : '',
    triggeredSkills ? `---\n## Triggered Skills\n${triggeredSkills}` : '',
    'Tools yang tersedia hanya Atlassian Jira dan Confluence. Jangan mengklaim memakai browser/web search.',
    contextMeta ? `## Context Metadata\n${contextMeta}` : '',
  ].filter(Boolean).join('\n\n');
}

function atlassianTools() {
  return [
    {
      name: 'atlassian_confluence_search',
      description: 'Search Confluence pages when the user asks for Confluence/internal docs. Returns matching page titles and excerpts when Atlassian credentials are configured.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number' } },
        required: ['query'],
      },
    },
    {
      name: 'atlassian_jira_search',
      description: 'Search Jira issues with JQL or plain text when the user asks about Jira tickets, sprint work, bugs, or tasks.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' }, jql: { type: 'string' }, limit: { type: 'number' } },
        required: ['query'],
      },
    },
  ];
}

function atlassianAuthHeaders() {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!email || !token) return null;
  return { authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`, accept: 'application/json' };
}

async function executeAtlassianTool(tool) {
  const baseUrl = String(process.env.ATLASSIAN_BASE_URL || '').replace(/\/$/, '');
  const headers = atlassianAuthHeaders();
  const input = tool.input || {};
  const limit = Math.min(Number(input.limit || 5), 10);

  if (!baseUrl || !headers) {
    return 'Atlassian connector belum dikonfigurasi. Set ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, dan ATLASSIAN_API_TOKEN di server untuk memakai Jira/Confluence nyata.';
  }

  if (tool.name === 'atlassian_confluence_search') {
    const cql = `text ~ "${String(input.query || '').replaceAll('"', '\\"')}"`;
    const url = `${baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}&expand=body.view,space`;
    const response = await fetch(url, { headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Confluence search gagal.');
    return (data.results || []).map((page) => `- ${page.title} (${page.space?.name || 'space'}): ${baseUrl}/wiki${page._links?.webui || ''}`).join('\n') || 'Tidak ada hasil Confluence.';
  }

  if (tool.name === 'atlassian_jira_search') {
    const jql = input.jql || `text ~ "${String(input.query || '').replaceAll('"', '\\"')}" ORDER BY updated DESC`;
    const url = `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=summary,status,assignee,updated`;
    const response = await fetch(url, { headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.errorMessages?.join(' ') || 'Jira search gagal.');
    return (data.issues || []).map((issue) => `- ${issue.key}: ${issue.fields?.summary || ''} [${issue.fields?.status?.name || 'status'}] ${baseUrl}/browse/${issue.key}`).join('\n') || 'Tidak ada hasil Jira.';
  }

  return `Tool tidak dikenal: ${tool.name}`;
}

async function callAnthropicJson({ apiKey, model, system, messages, maxTokens }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'anthropic-version': ANTHROPIC_VERSION, 'x-api-key': apiKey },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(ERROR_MESSAGES[response.status] || data?.error?.message || 'Request ke Claude API gagal.');
    error.status = response.status;
    error.details = data?.error || data;
    throw error;
  }
  return data;
}

async function callAnthropicStream({ apiKey, model, system, messages, maxTokens, tools }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'anthropic-version': ANTHROPIC_VERSION, 'x-api-key': apiKey },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, tools, tool_choice: { type: 'auto' }, stream: true }),
  });
  if (!response.ok) {
    let data = {};
    try { data = await response.json(); } catch {}
    const error = new Error(ERROR_MESSAGES[response.status] || data?.error?.message || 'Request ke Claude API gagal.');
    error.status = response.status;
    error.details = data?.error || data;
    throw error;
  }
  return response;
}

async function parseAnthropicStream(response, handlers) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines = [];

  async function flushEvent() {
    if (!dataLines.length) return;
    const raw = dataLines.join('\n');
    dataLines = [];
    if (raw === '[DONE]') return;
    let event;
    try { event = JSON.parse(raw); } catch { return; }
    await handlers.onEvent?.(eventName || event.type, event);
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
        await flushEvent();
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }
  if (buffer || dataLines.length) await flushEvent();
}

function extractTextFromAnthropic(data) {
  return textFromContent(data.content).trim();
}

function buildMemoryPrompt({ scope, existingMemory, project, messages }) {
  const transcript = normalizeMessages(messages).slice(-30).map((message) => `${message.role.toUpperCase()}: ${textFromContent(message.content)}`).join('\n\n');
  const target = scope === 'project' ? `Project ${project?.name || 'aktif'}` : scope === 'global' ? 'memori global pengguna lintas semua project' : 'ringkasan sesi percakapan';
  return [
    `Update ${target} dengan sangat ringkas, akurat, dan hemat token.`,
    'Jangan menyimpan rahasia seperti API key, password, token, atau data sensitif.',
    'Prioritaskan preferensi stabil, tujuan, keputusan, constraint, gaya kerja, dan open loops.',
    'Output hanya Markdown bullet pendek maksimal 10 bullet. Jika tidak ada hal baru, rapikan memori lama.',
    existingMemory ? `Memori/ringkasan sebelumnya:\n${existingMemory}` : 'Belum ada memori sebelumnya.',
    `Transcript terbaru:\n${transcript}`,
  ].join('\n\n');
}

async function handleChat(req, res, stream = false) {
  const rawBody = await readRequestBody(req);
  const body = rawBody ? JSON.parse(rawBody) : {};
  const apiKey = String(body.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    sendJson(res, 400, { error: 'API key belum tersedia. Isi di panel API Key atau jalankan server dengan ANTHROPIC_API_KEY.' });
    return;
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    sendJson(res, 400, { error: 'Percakapan harus dimulai dan berakhir dengan pesan user.' });
    return;
  }

  const model = String(body.model || DEFAULT_MODEL);
  const lastUserMessage = textFromContent(messages[messages.length - 1].content);
  const system = buildSystemPrompt({ ...body, lastUserMessage });
  const tools = atlassianTools();

  if (!stream) {
    const data = await callAnthropicJson({ apiKey, model, system, messages, maxTokens: Number(body.maxTokens || 8096) });
    sendJson(res, 200, { text: extractTextFromAnthropic(data), usage: data.usage, model: data.model || model });
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    connection: 'keep-alive',
  });
  sendSse(res, 'meta', { model, tools: tools.map((tool) => tool.name) });

  let workingMessages = [...messages];
  let finalUsage = null;
  let fullText = '';

  try {
    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop += 1) {
      const contentBlocks = [];
      let currentBlockIndex = -1;
      let stopReason = null;
      const upstream = await callAnthropicStream({ apiKey, model, system, messages: workingMessages, maxTokens: Number(body.maxTokens || 8096), tools });

      await parseAnthropicStream(upstream, {
        onEvent: async (_name, event) => {
          if (event.type === 'content_block_start') {
            currentBlockIndex = event.index;
            contentBlocks[currentBlockIndex] = event.content_block || {};
          }
          if (event.type === 'content_block_delta') {
            const block = contentBlocks[currentBlockIndex] || {};
            if (event.delta?.type === 'text_delta') {
              block.type = 'text';
              block.text = `${block.text || ''}${event.delta.text || ''}`;
              fullText += event.delta.text || '';
              sendSse(res, 'delta', { text: event.delta.text || '' });
            }
            if (event.delta?.type === 'input_json_delta') {
              block.partial_json = `${block.partial_json || ''}${event.delta.partial_json || ''}`;
            }
            contentBlocks[currentBlockIndex] = block;
          }
          if (event.type === 'content_block_stop') {
            const block = contentBlocks[event.index];
            if (block?.type === 'tool_use' && block.partial_json) {
              try { block.input = JSON.parse(block.partial_json); } catch { block.input = {}; }
              delete block.partial_json;
            }
          }
          if (event.type === 'message_delta') {
            stopReason = event.delta?.stop_reason || stopReason;
            finalUsage = event.usage || finalUsage;
          }
          if (event.type === 'message_stop') {
            stopReason = stopReason || 'end_turn';
          }
        },
      });

      const toolUses = contentBlocks.filter((block) => block?.type === 'tool_use');
      if (stopReason !== 'tool_use' || toolUses.length === 0) break;

      workingMessages.push({ role: 'assistant', content: contentBlocks.filter(Boolean) });
      const toolResults = await Promise.all(toolUses.map(async (tool) => {
        try {
          const content = await executeAtlassianTool(tool);
          sendSse(res, 'tool', { name: tool.name, status: 'ok', content });
          return { type: 'tool_result', tool_use_id: tool.id, content };
        } catch (error) {
          const content = error.message || 'Tool Atlassian gagal.';
          sendSse(res, 'tool', { name: tool.name, status: 'error', content });
          return { type: 'tool_result', tool_use_id: tool.id, content, is_error: true };
        }
      }));
      workingMessages.push({ role: 'user', content: toolResults });
    }

    sendSse(res, 'done', { text: fullText, usage: finalUsage, model });
    res.end();
  } catch (error) {
    sendSse(res, 'error', { error: error.message || 'Claude API gagal merespons.', details: error.details });
    res.end();
  }
}

async function handleMemory(req, res) {
  const rawBody = await readRequestBody(req);
  const body = rawBody ? JSON.parse(rawBody) : {};
  const apiKey = String(body.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    sendJson(res, 400, { error: 'API key belum tersedia untuk memory.' });
    return;
  }
  const messages = normalizeMessages(body.messages);
  if (!messages.length) {
    sendJson(res, 400, { error: 'Tidak ada transcript yang bisa diringkas menjadi memory.' });
    return;
  }
  try {
    const data = await callAnthropicJson({
      apiKey,
      model: String(body.model || 'claude-haiku-4-5-20251001'),
      maxTokens: Number(body.maxTokens || 700),
      system: 'Kamu adalah memory manager untuk aplikasi chat Claude-like. Tulis memori yang padat, faktual, dan aman.',
      messages: [{ role: 'user', content: buildMemoryPrompt(body) }],
    });
    sendJson(res, 200, { memory: extractTextFromAnthropic(data), usage: data.usage, model: data.model || body.model });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || 'Generate memory gagal.', details: error.details });
  }
}

async function handleCountTokens(req, res) {
  const rawBody = await readRequestBody(req);
  const body = rawBody ? JSON.parse(rawBody) : {};
  const apiKey = String(body.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    sendJson(res, 400, { error: 'API key belum tersedia untuk count_tokens.' });
    return;
  }
  const model = String(body.model || DEFAULT_MODEL);
  const messages = normalizeMessages(body.messages);
  const system = buildSystemPrompt({ ...body, lastUserMessage: textFromContent(messages.at(-1)?.content) });
  const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'anthropic-version': ANTHROPIC_VERSION, 'x-api-key': apiKey },
    body: JSON.stringify({ model, system, messages, tools: atlassianTools() }),
  });
  const data = await response.json();
  if (!response.ok) {
    sendJson(res, response.status, { error: ERROR_MESSAGES[response.status] || data?.error?.message || 'Count token gagal.', details: data?.error || data });
    return;
  }
  sendJson(res, 200, data);
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const unsafePath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(ROOT, unsafePath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream', 'cache-control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=60' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      hasServerApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      atlassianConfigured: Boolean(process.env.ATLASSIAN_BASE_URL && process.env.ATLASSIAN_EMAIL && process.env.ATLASSIAN_API_TOKEN),
      tools: ['atlassian_confluence_search', 'atlassian_jira_search'],
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    handleChat(req, res, false).catch((error) => sendJson(res, error.status || 500, { error: error.message || 'Server error.' }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/chat-stream') {
    handleChat(req, res, true).catch((error) => sendJson(res, error.status || 500, { error: error.message || 'Server error.' }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/memory') {
    handleMemory(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.message || 'Server error.' }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/count-tokens') {
    handleCountTokens(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.message || 'Server error.' }));
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }
  sendJson(res, 405, { error: 'Method tidak didukung.' });
});

server.listen(PORT, () => {
  console.log(`Nafis Claude Workspace berjalan di http://localhost:${PORT}`);
});
