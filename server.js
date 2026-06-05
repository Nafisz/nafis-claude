const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_BODY_BYTES = 1024 * 1024;

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

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
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

function compactMessages(messages = []) {
  const clean = messages
    .filter((message) => ['user', 'assistant'].includes(message.role) && String(message.text || '').trim())
    .map((message) => ({ role: message.role, content: String(message.text).trim() }));

  while (clean.length && clean[0].role !== 'user') clean.shift();

  return clean.reduce((acc, message) => {
    const previous = acc[acc.length - 1];
    if (previous?.role === message.role) {
      previous.content += `\n\n${message.content}`;
    } else {
      acc.push({ ...message });
    }
    return acc;
  }, []);
}

function buildSystemPrompt({ project, skills, tone }) {
  const activeSkills = (skills || [])
    .filter((skill) => skill.active)
    .map((skill) => `${skill.name}: ${skill.description}`)
    .join('\n- ');

  return [
    'Kamu adalah asisten workspace yang terasa seperti Claude: tenang, jelas, hangat, teliti, dan praktis.',
    'Jawab dalam Bahasa Indonesia kecuali pengguna meminta bahasa lain.',
    'Utamakan jawaban langsung, struktur Markdown rapi, dan langkah konkret.',
    `Intensitas berpikir UI: ${tone || 'Sedang'}. Sesuaikan kedalaman analisis dengan ini.`,
    project ? `Memori Project aktif: ${project.name}. ${project.memory}` : 'Tidak ada Project aktif; jangan mengasumsikan memori folder.',
    activeSkills ? `Skill aktif yang boleh kamu gunakan atau simulasikan secara eksplisit bila relevan:\n- ${activeSkills}` : 'Tidak ada skill aktif.',
    'Jika pengguna meminta file/artefak, tulis konten file yang siap dipakai dan beri nama file yang disarankan.',
    'Jika skill eksternal seperti Confluence belum memiliki kredensial sumber data, jelaskan batasannya dan minta koneksi yang dibutuhkan tanpa mengada-ada.',
  ].join('\n');
}

function extractTextFromAnthropic(data) {
  if (!Array.isArray(data.content)) return '';
  return data.content
    .filter((block) => block?.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n\n')
    .trim();
}

async function handleChat(req, res) {
  const rawBody = await readRequestBody(req);
  const body = rawBody ? JSON.parse(rawBody) : {};
  const apiKey = String(body.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    sendJson(res, 400, {
      error: 'API key belum tersedia. Isi di panel API Key atau jalankan server dengan ANTHROPIC_API_KEY.',
    });
    return;
  }

  const messages = compactMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    sendJson(res, 400, { error: 'Percakapan harus berakhir dengan pesan user.' });
    return;
  }

  const model = String(body.model || 'claude-sonnet-4-6');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(body.maxTokens || 1800),
      system: buildSystemPrompt(body),
      messages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    sendJson(res, response.status, {
      error: data?.error?.message || 'Request ke Claude API gagal.',
      details: data?.error || data,
    });
    return;
  }

  sendJson(res, 200, {
    text: extractTextFromAnthropic(data),
    usage: data.usage,
    model: data.model || model,
  });
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

    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=60',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true, hasServerApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    handleChat(req, res).catch((error) => {
      sendJson(res, 500, { error: error.message || 'Server error.' });
    });
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
