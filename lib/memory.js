const MEMORY_SECTIONS = [
  'Purpose & context',
  'Current state',
  'On the horizon',
  'Key learnings & principles',
  'Approach & patterns',
  'Tools & resources',
];

const STOP_WORDS = new Set([
  'yang', 'dan', 'atau', 'untuk', 'dari', 'dengan', 'pada', 'dalam', 'ini', 'itu', 'the', 'and', 'for', 'with',
  'user', 'assistant', 'saya', 'aku', 'kamu', 'kami', 'mereka', 'tentang', 'sebagai', 'agar', 'juga', 'akan', 'sudah',
]);

function normalizeText(value = '') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s_-]/g, ' ');
}

function keywords(value = '') {
  return [...new Set(normalizeText(value).split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)))];
}

function parseMemorySections(memory = '') {
  const text = String(memory || '').trim();
  if (!text) return [];
  const headingPattern = /^(?:#{1,3}\s*)?(Purpose & context|Current state|On the horizon|Key learnings & principles|Approach & patterns|Tools & resources)\s*$/gim;
  const matches = [...text.matchAll(headingPattern)];
  if (!matches.length) return [{ heading: 'Memory', content: text }];

  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return { heading: match[1], content: text.slice(start, end).trim() };
  }).filter((section) => section.content);
}

function scoreSection(section, queryTerms, scope) {
  const sectionTerms = new Set(keywords(`${section.heading} ${section.content}`));
  let score = queryTerms.reduce((total, term) => total + (sectionTerms.has(term) ? 4 : 0), 0);
  if (section.heading === 'Purpose & context') score += 3;
  if (section.heading === 'Approach & patterns') score += 2;
  if (scope === 'project' && section.heading === 'Current state') score += 2;
  if (scope === 'project' && section.heading === 'On the horizon') score += 1;
  return score;
}

function retrieveMemory(memory, query, options = {}) {
  const { scope = 'global', maxChars = scope === 'project' ? 9000 : 6000, maxSections = 4 } = options;
  const sections = parseMemorySections(memory);
  if (!sections.length) return '';
  if (sections.length === 1 && sections[0].heading === 'Memory') return sections[0].content.slice(0, maxChars);

  const queryTerms = keywords(query);
  const ranked = sections
    .map((section, index) => ({ ...section, index, score: scoreSection(section, queryTerms, scope) }))
    .filter((section) => section.score >= 2)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = [];
  let usedChars = 0;
  for (const section of ranked) {
    if (selected.length >= maxSections) break;
    const rendered = `${section.heading}\n${section.content}`;
    if (selected.length && usedChars + rendered.length > maxChars) continue;
    selected.push(section);
    usedChars += rendered.length;
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map((section) => `${section.heading}\n${section.content}`)
    .join('\n\n')
    .slice(0, maxChars);
}

function formatRetrievedMemory({ globalMemory, projectMemory, query }) {
  const global = retrieveMemory(globalMemory, query, { scope: 'global' });
  const project = retrieveMemory(projectMemory, query, { scope: 'project' });
  if (!global && !project) return '';
  return [
    '<memory_context>',
    global ? `<global_memory>\n${global}\n</global_memory>` : '',
    project ? `<project_memory>\n${project}\n</project_memory>` : '',
    '</memory_context>',
  ].filter(Boolean).join('\n\n');
}

function hasHighValueMemorySignal(messages = []) {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  const text = String(latestUser?.text || latestUser?.content || '');
  return /\b(ingat|remember|mulai sekarang|prefer|saya suka|saya tidak suka|jangan lagi|keputusan|diputuskan|final|source of truth|north star|prioritas|constraint|batasan|nama saya|tim saya|project ini)\b/i.test(text);
}

function validateMemoryDocument(memory, scope) {
  const text = String(memory || '').trim();
  if (!text) return { valid: false, reason: 'empty' };
  if (scope === 'session') return { valid: true, sections: [] };
  const sections = parseMemorySections(text);
  const recognized = sections.filter((section) => MEMORY_SECTIONS.includes(section.heading));
  if (recognized.length !== MEMORY_SECTIONS.length) return { valid: false, reason: 'missing-structure', sections: recognized };
  return { valid: true, sections: recognized };
}

function buildMemoryUpdatePrompt({ scope, existingMemory = '', project, messages = [] }) {
  const transcript = messages.slice(-30).map((message) => {
    const content = message.content ?? message.text ?? '';
    return `${String(message.role || 'unknown').toUpperCase()}: ${typeof content === 'string' ? content : JSON.stringify(content)}`;
  }).join('\n\n');
  const isProject = scope === 'project';
  const isGlobal = scope === 'global';
  const target = isProject ? `project memory for ${project?.name || 'the active project'}` : isGlobal ? 'global account memory across projects' : 'a compact session summary';
  const scopeRules = isGlobal
    ? [
        'Keep only durable facts about the user across projects: identity, stable preferences, communication style, recurring workflows, long-term goals, and broadly used tools.',
        'Do not copy project-specific architecture, temporary task status, page IDs, ticket IDs, or a project roadmap into global memory.',
      ]
    : isProject
      ? [
          'Keep durable facts that belong to this project: purpose, architecture, current validated state, accepted decisions, constraints, near-term plans, principles, stakeholders, and project resources.',
          'Do not generalize project facts into account-wide preferences. Include user preferences only when they directly govern work on this project.',
        ]
      : [
          'Summarize the active conversation for context continuity. Keep decisions, unresolved questions, corrections, and next actions.',
        ];

  return [
    `Maintain ${target}.`,
    ...scopeRules,
    'Treat the existing memory as a document to revise, not an append-only log.',
    'Merge duplicates, remove obsolete statements, and resolve contradictions in favor of the latest explicit user correction or confirmed decision.',
    'Do not infer uncertain facts. Do not store API keys, passwords, tokens, private credentials, or incidental personal data.',
    'Preserve exact identifiers (IDs, keys, URLs, names) only when they are durable and operationally useful in this scope.',
    scope === 'session'
      ? 'Output concise Markdown bullets, with no preamble.'
      : `Output only a compact Markdown document using these headings in this exact order:\n${MEMORY_SECTIONS.join('\n')}`,
    scope === 'session' ? '' : 'Include every heading. Under each heading, use dense factual paragraphs or bullets; write “None yet” when no supported information exists.',
    existingMemory ? `Existing memory:\n${existingMemory}` : 'Existing memory is empty.',
    isProject && project?.systemPrompt ? `Project instructions:\n${project.systemPrompt}` : '',
    `Recent transcript:\n${transcript}`,
  ].filter(Boolean).join('\n\n');
}

module.exports = {
  MEMORY_SECTIONS,
  keywords,
  parseMemorySections,
  retrieveMemory,
  formatRetrievedMemory,
  hasHighValueMemorySignal,
  buildMemoryUpdatePrompt,
  validateMemoryDocument,
};
