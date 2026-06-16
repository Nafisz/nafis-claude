const MUTATING_TOOLS = new Set([
  'atlassian_confluence_update_page',
  'atlassian_jira_create_issue',
  'atlassian_jira_update_issue',
  'atlassian_jira_add_comment',
]);

function triggerMatches(text, keywords = []) {
  const lower = String(text || '').toLowerCase();
  return keywords.some((keyword) => lower.includes(String(keyword).trim().toLowerCase()));
}

function selectTriggeredSkills(skills = [], userMessage = '', explicitSkillIds = []) {
  const explicitIds = new Set((Array.isArray(explicitSkillIds) ? explicitSkillIds : []).map(String));
  return skills
    .filter((skill) => skill?.active && (skill.content || skill.systemPromptFragment || skill.description))
    .filter((skill) => explicitIds.has(String(skill.id))
      || !skill.triggerKeywords?.length
      || triggerMatches(userMessage, skill.triggerKeywords));
}

function formatTriggeredSkills(skills = [], userMessage = '', explicitSkillIds = []) {
  return selectTriggeredSkills(skills, userMessage, explicitSkillIds)
    .map((skill) => `## Skill: ${skill.name}\n${skill.content || skill.systemPromptFragment || skill.description}`)
    .join('\n\n');
}

function isMutationAuthorized(toolName, latestUserMessage = '') {
  if (!MUTATING_TOOLS.has(toolName)) return true;
  const text = String(latestUserMessage).toLowerCase();
  const actionWords = /(buat|create|tambahkan|add|update|ubah|edit|perbarui|komentar|comment|tulis|write)/i;
  const targetWords = toolName.includes('jira') ? /(jira|issue|ticket|tiket)/i : /(confluence|page|halaman)/i;
  return actionWords.test(text) && targetWords.test(text);
}

function mergeUsage(total = {}, next = {}) {
  const merged = { ...total };
  for (const [key, value] of Object.entries(next || {})) {
    merged[key] = typeof value === 'number' ? Number(merged[key] || 0) + value : value;
  }
  return merged;
}

function createStreamAccumulator({ onText = () => {} } = {}) {
  const blocks = [];
  let stopReason = null;
  let usage = {};

  return {
    handle(event) {
      if (event.type === 'message_start') usage = mergeUsage(usage, event.message?.usage || {});
      if (event.type === 'content_block_start') blocks[event.index] = structuredClone(event.content_block || {});
      if (event.type === 'content_block_delta') {
        const block = blocks[event.index] || {};
        if (event.delta?.type === 'text_delta') {
          block.type = 'text';
          block.text = `${block.text || ''}${event.delta.text || ''}`;
          onText(event.delta.text || '');
        }
        if (event.delta?.type === 'input_json_delta') {
          block.partial_json = `${block.partial_json || ''}${event.delta.partial_json || ''}`;
        }
        blocks[event.index] = block;
      }
      if (event.type === 'content_block_stop') {
        const block = blocks[event.index];
        if (block?.type === 'tool_use' && block.partial_json) {
          try {
            block.input = JSON.parse(block.partial_json);
          } catch {
            block.input = null;
            block.inputError = 'Tool input JSON is invalid.';
          }
          delete block.partial_json;
        }
      }
      if (event.type === 'message_delta') {
        stopReason = event.delta?.stop_reason || stopReason;
        usage = mergeUsage(usage, event.usage || {});
      }
      if (event.type === 'message_stop') stopReason ||= 'end_turn';
    },
    result() {
      return { blocks: blocks.filter(Boolean), stopReason, usage };
    },
  };
}

async function runAgentLoop({ messages, maxLoops = 4, streamModel, executeTool, onText, onTool }) {
  const workingMessages = structuredClone(messages);
  let usage = {};
  let text = '';

  for (let loop = 0; loop <= maxLoops; loop += 1) {
    const accumulator = createStreamAccumulator({
      onText(delta) {
        text += delta;
        onText?.(delta);
      },
    });
    await streamModel(workingMessages, (event) => accumulator.handle(event));
    const result = accumulator.result();
    usage = mergeUsage(usage, result.usage);
    const toolUses = result.blocks.filter((block) => block.type === 'tool_use');

    if (result.stopReason !== 'tool_use') return { text, usage, messages: workingMessages, stopReason: result.stopReason || 'end_turn' };
    if (!toolUses.length) throw new Error('Claude stopped for tool use but did not send a valid tool_use block.');
    if (loop === maxLoops) throw new Error(`Agent exceeded the ${maxLoops} tool-loop limit.`);

    workingMessages.push({ role: 'assistant', content: result.blocks });
    const toolResults = await Promise.all(toolUses.map(async (tool) => {
      let outcome;
      if (tool.inputError || tool.input === null) {
        outcome = { content: tool.inputError || 'Tool input is invalid.', isError: true };
      } else {
        try {
          outcome = { content: await executeTool(tool), isError: false };
        } catch (error) {
          outcome = { content: error.message || 'Tool execution failed.', isError: true };
        }
      }
      onTool?.({ id: tool.id, name: tool.name, status: outcome.isError ? 'error' : 'ok', content: outcome.content });
      return { type: 'tool_result', tool_use_id: tool.id, content: String(outcome.content), ...(outcome.isError ? { is_error: true } : {}) };
    }));
    workingMessages.push({ role: 'user', content: toolResults });
  }
  throw new Error('Agent loop stopped without a final result.');
}

async function runJsonAgentLoop({ messages, maxLoops = 4, callModel, executeTool }) {
  const workingMessages = structuredClone(messages);
  let text = '';
  let usage = {};
  let model;

  for (let loop = 0; loop <= maxLoops; loop += 1) {
    const response = await callModel(workingMessages);
    model = response.model || model;
    usage = mergeUsage(usage, response.usage || {});
    const blocks = Array.isArray(response.content) ? response.content : [];
    text += blocks.filter((block) => block.type === 'text').map((block) => block.text || '').join('');
    const toolUses = blocks.filter((block) => block.type === 'tool_use');
    if (response.stop_reason !== 'tool_use') return { text, usage, model, messages: workingMessages, stopReason: response.stop_reason || 'end_turn' };
    if (!toolUses.length) throw new Error('Claude stopped for tool use but did not send a valid tool_use block.');
    if (loop === maxLoops) throw new Error(`Agent exceeded the ${maxLoops} tool-loop limit.`);

    workingMessages.push({ role: 'assistant', content: blocks });
    const toolResults = await Promise.all(toolUses.map(async (tool) => {
      try {
        return { type: 'tool_result', tool_use_id: tool.id, content: String(await executeTool(tool)) };
      } catch (error) {
        return { type: 'tool_result', tool_use_id: tool.id, content: error.message || 'Tool execution failed.', is_error: true };
      }
    }));
    workingMessages.push({ role: 'user', content: toolResults });
  }
  throw new Error('Agent loop stopped without a final result.');
}

module.exports = {
  MUTATING_TOOLS,
  triggerMatches,
  selectTriggeredSkills,
  formatTriggeredSkills,
  mergeUsage,
  isMutationAuthorized,
  createStreamAccumulator,
  runAgentLoop,
  runJsonAgentLoop,
};
