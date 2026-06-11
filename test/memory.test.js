const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MEMORY_SECTIONS,
  parseMemorySections,
  retrieveMemory,
  formatRetrievedMemory,
  hasHighValueMemorySignal,
  buildMemoryUpdatePrompt,
  validateMemoryDocument,
} = require('../lib/memory');

const novaxMemory = `Purpose & context
Nafis is building NovaX Arena, an edtech platform for consequence-driven decision training.

Current state
Database uses PostgreSQL. Redis is the runtime cache and the database is not touched during active arena play.

On the horizon
Complete the first functional arena and test it in target schools.

Key learnings & principles
Explicit frameworks constrain AI. Database specs describe storage, not mechanism behavior.

Approach & patterns
Communication should be direct and concise. Evaluate design options before execution.

Tools & resources
Confluence space KAN is the source of truth. Jira project key is KAN.`;

test('parses the Claude-like memory section format', () => {
  const sections = parseMemorySections(novaxMemory);
  assert.deepEqual(sections.map((section) => section.heading), MEMORY_SECTIONS);
});

test('retrieves project details relevant to the current query', () => {
  const result = retrieveMemory(novaxMemory, 'How should Redis and PostgreSQL work during active arena play?', { scope: 'project', maxSections: 3 });
  assert.match(result, /Current state/);
  assert.match(result, /database is not touched during active arena play/);
  assert.doesNotMatch(result, /TikTok/);
});

test('keeps global and project memories isolated and labeled', () => {
  const result = formatRetrievedMemory({
    globalMemory: 'Approach & patterns\nCommunication should be direct and concise.',
    projectMemory: novaxMemory,
    query: 'Update the Confluence source of truth',
  });
  assert.match(result, /<global_memory>/);
  assert.match(result, /direct and concise/);
  assert.match(result, /<project_memory>/);
  assert.match(result, /Confluence space KAN/);
});

test('detects explicit durable-memory signals without triggering on ordinary chat', () => {
  assert.equal(hasHighValueMemorySignal([{ role: 'user', text: 'Mulai sekarang jangan ulangi konsep yang sudah saya tolak.' }]), true);
  assert.equal(hasHighValueMemorySignal([{ role: 'user', text: 'Jelaskan fungsi array map.' }]), false);
});


test('global memory prompt excludes project-specific operational details', () => {
  const prompt = buildMemoryUpdatePrompt({ scope: 'global', existingMemory: '', messages: [{ role: 'user', text: 'I prefer concise answers.' }] });
  assert.match(prompt, /durable facts about the user across projects/);
  assert.match(prompt, /Do not copy project-specific architecture/);
  assert.match(prompt, /Purpose & context[\s\S]*Tools & resources/);
});

test('project memory prompt revises contradictions and preserves useful identifiers', () => {
  const prompt = buildMemoryUpdatePrompt({
    scope: 'project',
    project: { name: 'NovaX Arena', systemPrompt: 'Use Confluence as source of truth.' },
    existingMemory: novaxMemory,
    messages: [{ role: 'user', text: 'Final: Redis is the active runtime cache.' }],
  });
  assert.match(prompt, /resolve contradictions in favor of the latest explicit user correction/);
  assert.match(prompt, /Preserve exact identifiers/);
  assert.match(prompt, /project memory for NovaX Arena/);
});


test('rejects malformed durable memory so a bad generation cannot overwrite good memory', () => {
  assert.equal(validateMemoryDocument('Here is your updated memory: user likes concise answers.', 'global').valid, false);
  assert.equal(validateMemoryDocument('Purpose & context\nOnly one section.', 'project').valid, false);
  assert.equal(validateMemoryDocument(novaxMemory, 'project').valid, true);
  assert.equal(validateMemoryDocument('- Decision retained\n- Next action retained', 'session').valid, true);
});
