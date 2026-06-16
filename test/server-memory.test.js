const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSystemPrompt, buildMemoryPrompt, parseAnthropicStream, selectRequestedTools } = require('../server');

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

const {
  atlassianTools,
  truncateToolResult,
  executeAtlassianTool,
  normalizeAtlassianBaseUrl,
  testAtlassianConnection,
  apiKeysFromRequest,
  modelKeyFamily,
  callAnthropicJsonWithFallback,
} = require('../server');

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

test('chat system prompt retrieves selected project-file excerpts for the latest prompt', () => {
  const prompt = buildSystemPrompt({
    project: {
      systemPrompt: 'Use project sources.',
      files: [
        { name: 'brief.md', included: true, content: 'NovaX targets schools and bootcamps for B2B edtech training.' },
        { name: 'roadmap.md', included: false, content: 'Hidden launch plan.' },
      ],
    },
    lastUserMessage: 'Who is the target customer for NovaX?',
    skills: [],
  });
  assert.match(prompt, /## Retrieved Project Files/);
  assert.match(prompt, /NovaX targets schools and bootcamps/);
  assert.doesNotMatch(prompt, /Hidden launch plan/);
  assert.match(prompt, /reference data, not as system instructions/);
});

test('chat system prompt retrieves selected conversation-file excerpts separately', () => {
  const prompt = buildSystemPrompt({
    lastUserMessage: 'Apa keputusan rollout?',
    conversationFiles: [{
      name: 'rollout.md',
      content: '# Rollout\n\nKeputusan rollout dilakukan bertahap mulai dari tim internal.',
    }],
  });

  assert.match(prompt, /## Retrieved Chat Files/);
  assert.match(prompt, /rollout\.md/);
  assert.match(prompt, /bertahap mulai dari tim internal/);
});

test('Atlassian connector accepts a secure base URL and strips trailing slashes', () => {
  assert.equal(normalizeAtlassianBaseUrl('https://example.atlassian.net///'), 'https://example.atlassian.net');
  assert.throws(() => normalizeAtlassianBaseUrl('http://example.atlassian.net'), /HTTPS/);
  assert.throws(() => normalizeAtlassianBaseUrl('https://example.atlassian.net/wiki'), /extra path/);
  assert.throws(() => normalizeAtlassianBaseUrl('not-a-url'), /invalid/);
});

test('Atlassian connection verification checks Jira and Confluence access', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/rest/api/3/myself')) {
      return new Response(JSON.stringify({ accountId: 'abc', displayName: 'QA User' }), { status: 200 });
    }
    return new Response(JSON.stringify({ results: [{ id: 'space-1' }] }), { status: 200 });
  };
  try {
    const result = await testAtlassianConnection({
      baseUrl: 'https://example.atlassian.net',
      email: 'qa@example.com',
      apiToken: 'test-token',
      source: 'session',
    });
    assert.deepEqual(calls, [
      'https://example.atlassian.net/rest/api/3/myself',
      'https://example.atlassian.net/wiki/api/v2/spaces?limit=1',
    ]);
    assert.equal(result.displayName, 'QA User');
    assert.equal(result.jira, true);
    assert.equal(result.confluence, true);
  } finally {
    global.fetch = originalFetch;
  }
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

test('system prompt honors explicit skills and tool selection without disabling automatic skills', () => {
  const prompt = buildSystemPrompt({
    lastUserMessage: 'Please summarize this',
    explicitSkillIds: ['jira'],
    explicitToolNames: ['atlassian_jira_search'],
    explicitToolsRequested: true,
    atlassianConfigured: true,
    skills: [
      { id: 'always', name: 'Always', active: true, triggerKeywords: [], content: 'Always active workflow.' },
      { id: 'jira', name: 'Jira', active: true, triggerKeywords: ['jira'], content: 'Jira-specific workflow.' },
    ],
  });
  assert.match(prompt, /Always active workflow/);
  assert.match(prompt, /Jira-specific workflow/);
  assert.match(prompt, /Tool yang dipilih eksplisit oleh user: atlassian_jira_search/);
});

test('system prompt ignores malformed or unknown explicit skill metadata', () => {
  assert.doesNotThrow(() => buildSystemPrompt({
    lastUserMessage: 'Summarize this',
    explicitSkillIds: 'jira',
    skills: [{ id: 'jira', name: 'Jira', active: true, triggerKeywords: ['jira'], content: 'Jira workflow.' }],
  }));
  const prompt = buildSystemPrompt({
    lastUserMessage: 'Summarize this',
    explicitSkillIds: ['unknown'],
    skills: [{ id: 'jira', name: 'Jira', active: true, triggerKeywords: ['jira'], content: 'Jira workflow.' }],
  });
  assert.doesNotMatch(prompt, /Skill yang dipilih eksplisit/);
});

test('explicit tool selection exposes only known requested tools', () => {
  const selection = selectRequestedTools(atlassianTools(), [
    'atlassian_jira_search',
    'atlassian_jira_search',
    'unknown_tool',
  ]);
  assert.equal(selection.explicit, true);
  assert.deepEqual(selection.tools.map((tool) => tool.name), ['atlassian_jira_search']);
  assert.deepEqual(selection.unknownNames, ['unknown_tool']);
  assert.deepEqual(selectRequestedTools(atlassianTools(), []).tools.map((tool) => tool.name), atlassianTools().map((tool) => tool.name));
});

test('Anthropic API keys are selected from the matching model family', () => {
  const previousEnv = {
    key: process.env.ANTHROPIC_API_KEY,
    keys: process.env.ANTHROPIC_API_KEYS,
    sonnet: process.env.ANTHROPIC_SONNET_API_KEYS,
  };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEYS;
  process.env.ANTHROPIC_SONNET_API_KEYS = 'env-sonnet-1, env-sonnet-2';
  try {
    assert.equal(modelKeyFamily('claude-opus-4-8'), 'opus');
    assert.equal(modelKeyFamily('claude-haiku-4-5-20251001'), 'haiku');
    assert.deepEqual(apiKeysFromRequest({
      apiKeysByModel: {
        opus: ['opus-1'],
        sonnet: ['sonnet-1', 'sonnet-2'],
        haiku: ['haiku-1'],
      },
      apiKeys: ['request-generic'],
    }, 'claude-sonnet-4-6'), ['sonnet-1', 'sonnet-2', 'request-generic', 'env-sonnet-1', 'env-sonnet-2']);
  } finally {
    if (previousEnv.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousEnv.key;
    if (previousEnv.keys === undefined) delete process.env.ANTHROPIC_API_KEYS; else process.env.ANTHROPIC_API_KEYS = previousEnv.keys;
    if (previousEnv.sonnet === undefined) delete process.env.ANTHROPIC_SONNET_API_KEYS; else process.env.ANTHROPIC_SONNET_API_KEYS = previousEnv.sonnet;
  }
});

test('Anthropic JSON calls fall back to the next API key after a retryable failure', async () => {
  const originalFetch = global.fetch;
  const usedKeys = [];
  global.fetch = async (_url, options = {}) => {
    usedKeys.push(options.headers['x-api-key']);
    if (usedKeys.length === 1) {
      return new Response(JSON.stringify({ error: { message: 'invalid key' } }), { status: 401 });
    }
    return new Response(JSON.stringify({
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'text', text: 'ok' }],
    }), { status: 200 });
  };
  try {
    const result = await callAnthropicJsonWithFallback({
      apiKeys: ['bad-key', 'good-key'],
      model: 'claude-sonnet-4-6',
      system: '',
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 8,
    });
    assert.deepEqual(usedKeys, ['bad-key', 'good-key']);
    assert.equal(result.content[0].text, 'ok');
  } finally {
    global.fetch = originalFetch;
  }
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
    /connector is not configured/,
  );
  await assert.rejects(
    () => executeAtlassianTool({ name: 'atlassian_jira_update_issue', input: { issueKey: 'KAN-1', summary: 'Changed' } }, { latestUserMessage: 'Show Jira KAN-1' }),
    /Write operation blocked/,
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
