const test = require('node:test');
const assert = require('node:assert/strict');
const {
  selectTriggeredSkills,
  formatTriggeredSkills,
  isMutationAuthorized,
  createStreamAccumulator,
  runAgentLoop,
  runJsonAgentLoop,
} = require('../lib/orchestration');

const skills = [
  { id: 'always', name: 'Always', active: true, triggerKeywords: [], content: 'Always apply.' },
  { id: 'jira', name: 'Jira workflow', active: true, triggerKeywords: ['jira', 'ticket'], content: 'Read before write.' },
  { id: 'off', name: 'Disabled', active: false, triggerKeywords: [], content: 'Never apply.' },
];

test('skills are injected only when active and triggered; empty keywords means always-on', () => {
  assert.deepEqual(selectTriggeredSkills(skills, 'Please inspect Jira ticket KAN-1').map((skill) => skill.id), ['always', 'jira']);
  assert.deepEqual(selectTriggeredSkills(skills, 'Write a plain summary').map((skill) => skill.id), ['always']);
  assert.match(formatTriggeredSkills(skills, 'jira'), /Read before write/);
  assert.doesNotMatch(formatTriggeredSkills(skills, 'jira'), /Never apply/);
});

test('explicit skill selection triggers an active skill without matching keywords and avoids duplicates', () => {
  assert.deepEqual(
    selectTriggeredSkills(skills, 'Write a plain summary', ['jira']).map((skill) => skill.id),
    ['always', 'jira'],
  );
  assert.deepEqual(
    selectTriggeredSkills(skills, 'Inspect Jira', ['jira']).map((skill) => skill.id),
    ['always', 'jira'],
  );
  assert.doesNotMatch(formatTriggeredSkills(skills, 'summary', ['off']), /Never apply/);
});

test('mutation authorization requires explicit write intent and matching Atlassian product', () => {
  assert.equal(isMutationAuthorized('atlassian_jira_update_issue', 'Show Jira KAN-1'), false);
  assert.equal(isMutationAuthorized('atlassian_jira_update_issue', 'Update Jira issue KAN-1 summary'), true);
  assert.equal(isMutationAuthorized('atlassian_confluence_update_page', 'Update Jira issue KAN-1'), false);
  assert.equal(isMutationAuthorized('atlassian_confluence_update_page', 'Perbarui halaman Confluence ini'), true);
  assert.equal(isMutationAuthorized('atlassian_jira_search', 'search'), true);
});

test('stream accumulator keeps interleaved block indexes and parses tool JSON', () => {
  const deltas = [];
  const accumulator = createStreamAccumulator({ onText: (delta) => deltas.push(delta) });
  [
    { type: 'message_start', message: { usage: { input_tokens: 10 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tool-1', name: 'atlassian_jira_get_issue', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Checking ' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"issueKey":' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"KAN-1"}' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 6 } },
  ].forEach((event) => accumulator.handle(event));
  const result = accumulator.result();
  assert.equal(result.blocks[0].text, 'Checking ');
  assert.deepEqual(result.blocks[1].input, { issueKey: 'KAN-1' });
  assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 6 });
  assert.deepEqual(deltas, ['Checking ']);
});

test('agent loop executes parallel tool calls, appends protocol-correct results, then returns final text', async () => {
  const modelCalls = [];
  const toolEvents = [];
  let call = 0;
  const result = await runAgentLoop({
    messages: [{ role: 'user', content: 'Compare Jira and Confluence.' }],
    async streamModel(messages, emit) {
      modelCalls.push(structuredClone(messages));
      call += 1;
      if (call === 1) {
        emit({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'a', name: 'atlassian_jira_get_issue', input: {} } });
        emit({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"issueKey":"KAN-1"}' } });
        emit({ type: 'content_block_stop', index: 0 });
        emit({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'b', name: 'atlassian_confluence_get_page', input: {} } });
        emit({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"pageId":"42"}' } });
        emit({ type: 'content_block_stop', index: 1 });
        emit({ type: 'message_delta', delta: { stop_reason: 'tool_use' } });
      } else {
        emit({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
        emit({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Final comparison' } });
        emit({ type: 'message_delta', delta: { stop_reason: 'end_turn' } });
      }
    },
    async executeTool(tool) { return `${tool.name}:${Object.values(tool.input)[0]}`; },
    onTool(event) { toolEvents.push(event); },
  });
  assert.equal(result.text, 'Final comparison');
  assert.equal(toolEvents.length, 2);
  assert.equal(modelCalls[1][1].role, 'assistant');
  assert.deepEqual(modelCalls[1][2].content.map((block) => block.tool_use_id), ['a', 'b']);
  assert.ok(modelCalls[1][2].content.every((block) => block.type === 'tool_result'));
});

test('agent loop returns invalid tool JSON as an error result instead of crashing', async () => {
  let call = 0;
  const seen = [];
  const result = await runAgentLoop({
    messages: [{ role: 'user', content: 'Read Jira.' }],
    async streamModel(_messages, emit) {
      call += 1;
      if (call === 1) {
        emit({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'bad', name: 'atlassian_jira_get_issue', input: {} } });
        emit({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{bad' } });
        emit({ type: 'content_block_stop', index: 0 });
        emit({ type: 'message_delta', delta: { stop_reason: 'tool_use' } });
      } else {
        emit({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
        emit({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Recovered' } });
        emit({ type: 'message_delta', delta: { stop_reason: 'end_turn' } });
      }
    },
    executeTool() { throw new Error('must not execute'); },
    onTool(event) { seen.push(event); },
  });
  assert.equal(result.text, 'Recovered');
  assert.equal(seen[0].status, 'error');
  assert.match(seen[0].content, /JSON tidak valid/);
});


test('non-stream agent loop also executes tools and returns final answer', async () => {
  let call = 0;
  const calls = [];
  const result = await runJsonAgentLoop({
    messages: [{ role: 'user', content: 'Read KAN-1' }],
    maxLoops: 1,
    async callModel(messages) {
      calls.push(structuredClone(messages));
      call += 1;
      if (call === 1) return { stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 2 }, content: [{ type: 'tool_use', id: 't1', name: 'atlassian_jira_get_issue', input: { issueKey: 'KAN-1' } }] };
      return { stop_reason: 'end_turn', model: 'claude-test', usage: { input_tokens: 14, output_tokens: 5 }, content: [{ type: 'text', text: 'Issue loaded' }] };
    },
    async executeTool() { return '{"key":"KAN-1"}'; },
  });
  assert.equal(result.text, 'Issue loaded');
  assert.equal(result.model, 'claude-test');
  assert.deepEqual(result.usage, { input_tokens: 24, output_tokens: 7 });
  assert.equal(calls[1][2].content[0].tool_use_id, 't1');
});
