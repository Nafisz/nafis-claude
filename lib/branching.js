(function exposeBranching(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NafisBranching = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function branchTitle(title = 'Untitled') {
    const clean = String(title).replace(/\s+(?:—|-)\s*branch(?: \d+)?$/i, '').trim() || 'Untitled';
    return `${clean} - branch`;
  }

  function createConversationBranch({ conversation, messages = [], throughMessageId, id, now, idFactory }) {
    if (!conversation) throw new Error('Source conversation not found.');
    if (!messages.length) throw new Error('Source conversation has no messages to branch.');

    const branchIndex = throughMessageId
      ? messages.findIndex((message) => message.id === throughMessageId)
      : messages.length - 1;
    if (branchIndex < 0) throw new Error('Branch point not found.');

    const copiedMessages = messages.slice(0, branchIndex + 1).map((message) => {
      const copy = typeof structuredClone === 'function' ? structuredClone(message) : JSON.parse(JSON.stringify(message));
      return {
        ...copy,
        id: idFactory(),
        sourceMessageId: message.sourceMessageId || message.id,
        streaming: false,
      };
    });
    const branchPoint = messages[branchIndex];
    const rootConversationId = conversation.rootConversationId || conversation.id;

    return {
      conversation: {
        ...conversation,
        id,
        title: branchTitle(conversation.title),
        preview: `Branched from: ${String(branchPoint.text || '').slice(0, 62)}`,
        updated: 'Just now',
        parentConversationId: conversation.id,
        rootConversationId,
        branchPointMessageId: branchPoint.id,
        branchedAt: now,
        createdAt: now,
      },
      messages: copiedMessages,
      sourceMessageCount: branchIndex + 1,
    };
  }

  return { branchTitle, createConversationBranch };
}));
