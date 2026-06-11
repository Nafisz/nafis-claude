const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSystemPrompt, buildMemoryPrompt, parseAnthropicStream } = require('../server');

const projectMemory = `Purpose & context
NovaX Arena trains decision-making under novelty.

Current state
Redis owns active arena runtime state. PostgreSQL stores durable decision events.

On the horizon
TikTok content production will begin after traction signals.

Approach & patterns
Confluence must be re-read before dependent pages are updated.

Tools & resources
Confluence space KAN and Jira project KAN are used.`;

test('chat system prompt retrieves relevant project memory instead of injecting every section', () => {
  const prompt = buildSystemPrompt({
    project: { systemPrompt: 'Follow NovaX project instructions.', generatedMemory: projectMemory },
    globalMemory: 'Approach & patterns\nKeep answers direct and concise.',
    lastUserMessage: 'How should Redis and PostgreSQL work during arena runtime?',
    skills: [],
  });
  assert.match(prompt, /<global_memory>[\s\S]*direct and concise/);
  assert.match(prompt, /<project_memory>[\s\S]*Redis owns active arena runtime state/);
  assert.doesNotMatch(prompt, /TikTok content production/);
  assert.match(prompt, /Memory adalah konteks pendukung/);
});

test('memory generation prompt uses Claude-like headings and strict project scope', () => {
  const prompt = buildMemoryPrompt({
    scope: 'project',
    project: { name: 'NovaX Arena', systemPrompt: 'Confluence is source of truth.' },
    existingMemory: projectMemory,
    messages: [{ role: 'user', content: 'Final decision: Redis is never bypassed during active play.' }],
  });
  assert.match(prompt, /Purpose & context[\s\S]*Current state[\s\S]*Tools & resources/);
  assert.match(prompt, /latest explicit user correction or confirmed decision/);
  assert.match(prompt, /Do not generalize project facts into account-wide preferences/);
});

const { atlassianTools, truncateToolResult, executeAtlassianTool } = require('../server');

test('Atlassian tool registry exposes read and explicit-write operations with strict schemas', () => {
  const tools = atlassianTools();
  assert.deepEqual(tools.map((tool) => tool.name), [
    'atlassian_confluence_search',
    'atlassian_confluence_get_page',
    'atlassian_confluence_update_page',
    'atlassian_jira_search',
    'atlassian_jira_get_issue',
    'atlassian_jira_create_issue',
    'atlassian_jira_update_issue',
    'atlassian_jira_add_comment',
  ]);
  assert.ok(tools.every((tool) => tool.input_schema.additionalProperties === false));
  assert.match(tools.find((tool) => tool.name === 'atlassian_confluence_update_page').description, /explicitly/);
});

test('system prompt does not pretend Atlassian is available when connector is missing', () => {
  const unavailable = buildSystemPrompt({ lastUserMessage: 'Read Jira KAN-1', skills: [], atlassianConfigured: false });
  const available = buildSystemPrompt({ lastUserMessage: 'Read Jira KAN-1', skills: [], atlassianConfigured: true });
  assert.match(unavailable, /Connector Atlassian belum dikonfigurasi/);
  assert.match(available, /Tools yang tersedia hanya Atlassian/);
});


test('system prompt injects only skills triggered by the latest user message', () => {
  const prompt = buildSystemPrompt({
    lastUserMessage: 'Please inspect Jira KAN-1',
    skills: [
      { name: 'Always', active: true, triggerKeywords: [], content: 'Always active workflow.' },
      { name: 'Jira', active: true, triggerKeywords: ['jira'], content: 'Jira-specific workflow.' },
      { name: 'Confluence', active: true, triggerKeywords: ['confluence'], content: 'Confluence-only workflow.' },
    ],
  });
  assert.match(prompt, /Always active workflow/);
  assert.match(prompt, /Jira-specific workflow/);
  assert.doesNotMatch(prompt, /Confluence-only workflow/);
});

test('tool results are bounded before being exposed to UI/model context', () => {
  const result = truncateToolResult('x'.repeat(100), 20);
  assert.ok(result.length < 60);
  assert.match(result, /truncated/);
});


test('Anthropic SSE parser surfaces upstream error events', async () => {
  const payload = 'event: error\ndata: {"type":"error","error":{"message":"overloaded"}}\n\n';
  const response = new Response(payload, { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(() => parseAnthropicStream(response, { onEvent() {} }), /overloaded/);
});


test('tool execution reports missing connector and blocks unauthorized writes before network access', async () => {
  await assert.rejects(
    () => executeAtlassianTool({ name: 'atlassian_jira_search', input: { query: 'KAN' } }, { latestUserMessage: 'Search Jira' }),
    /connector belum dikonfigurasi/,
  );
  await assert.rejects(
    () => executeAtlassianTool({ name: 'atlassian_jira_update_issue', input: { issueKey: 'KAN-1', summary: 'Changed' } }, { latestUserMessage: 'Show Jira KAN-1' }),
    /Operasi tulis diblokir/,
  );
});

test('Confluence update reads current version then sends a complete storage body', async () => {
  const previousEnv = {
    base: process.env.ATLASSIAN_BASE_URL,
    email: process.env.ATLASSIAN_EMAIL,
    token: process.env.ATLASSIAN_API_TOKEN,
  };
  const originalFetch = global.fetch;
  process.env.ATLASSIAN_BASE_URL = 'https://example.atlassian.net';
  process.env.ATLASSIAN_EMAIL = 'test@example.com';
  process.env.ATLASSIAN_API_TOKEN = 'test-token';
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method || options.method === 'GET') {
      return new Response(JSON.stringify({ id: '42', title: 'Page', version: { number: 7 }, body: { storage: { value: '<p>old</p>' } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: '42', title: 'Page', version: { number: 8 } }), { status: 200 });
  };
  try {
    const result = await executeAtlassianTool(
      { name: 'atlassian_confluence_update_page', input: { pageId: '42', title: 'Page', html: '<p>complete new body</p>', versionMessage: 'Sync spec' } },
      { latestUserMessage: 'Update halaman Confluence 42 sekarang' },
    );
    assert.equal(calls.length, 2);
    const body = JSON.parse(calls[1].options.body);
    assert.equal(body.version.number, 8);
    assert.equal(body.body.representation, 'storage');
    assert.equal(body.body.value, '<p>complete new body</p>');
    assert.match(result, /updated/);
  } finally {
    global.fetch = originalFetch;
    if (previousEnv.base === undefined) delete process.env.ATLASSIAN_BASE_URL; else process.env.ATLASSIAN_BASE_URL = previousEnv.base;
    if (previousEnv.email === undefined) delete process.env.ATLASSIAN_EMAIL; else process.env.ATLASSIAN_EMAIL = previousEnv.email;
    if (previousEnv.token === undefined) delete process.env.ATLASSIAN_API_TOKEN; else process.env.ATLASSIAN_API_TOKEN = previousEnv.token;
  }
});
