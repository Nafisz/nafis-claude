const test = require('node:test');
const assert = require('node:assert/strict');
const { createConversationBranch, branchTitle } = require('../lib/branching');

const source = {
  id: 10,
  title: 'NovaX architecture',
  projectId: 'nova',
  model: 'claude-sonnet-4-6',
};
const messages = [
  { id: 'm1', role: 'user', text: 'Design the runtime.' },
  { id: 'm2', role: 'assistant', text: 'Use Redis during active play.' },
  { id: 'm3', role: 'user', text: 'Now discuss analytics.' },
];

test('branches through a selected message and preserves inherited project/model', () => {
  let sequence = 0;
  const result = createConversationBranch({
    conversation: source,
    messages,
    throughMessageId: 'm2',
    id: 20,
    now: '2026-06-09T00:00:00.000Z',
    idFactory: () => `copy-${++sequence}`,
  });
  assert.equal(result.conversation.projectId, 'nova');
  assert.equal(result.conversation.model, 'claude-sonnet-4-6');
  assert.equal(result.conversation.parentConversationId, 10);
  assert.equal(result.conversation.rootConversationId, 10);
  assert.equal(result.conversation.branchPointMessageId, 'm2');
  assert.deepEqual(result.messages.map((message) => message.text), messages.slice(0, 2).map((message) => message.text));
  assert.notEqual(result.messages[0].id, messages[0].id);
  assert.equal(result.messages[1].sourceMessageId, 'm2');
  result.messages[0].text = 'Changed only in branch';
  assert.equal(messages[0].text, 'Design the runtime.');
});

test('branching an existing branch keeps the original root lineage', () => {
  const result = createConversationBranch({
    conversation: { ...source, id: 20, parentConversationId: 10, rootConversationId: 10, title: 'NovaX architecture — branch' },
    messages,
    id: 30,
    now: '2026-06-09T00:00:00.000Z',
    idFactory: () => crypto.randomUUID(),
  });
  assert.equal(result.conversation.parentConversationId, 20);
  assert.equal(result.conversation.rootConversationId, 10);
  assert.equal(branchTitle(result.conversation.title), 'NovaX architecture — branch');
});
