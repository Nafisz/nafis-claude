const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FileStore } = require('../lib/file-store');

test('file store persists streamed uploads and reloads metadata from disk', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nafis-files-'));
  try {
    const store = new FileStore(root);
    const saved = await store.saveBuffer(Buffer.from('Persistent project context.'), {
      name: 'brief.md',
      type: 'text/markdown',
      scope: 'project',
      scopeId: 'nova',
    });
    const reloaded = new FileStore(root);
    assert.deepEqual((await reloaded.list('project', 'nova')).map((file) => file.name), ['brief.md']);
    assert.equal((await reloaded.readSelected([saved.id]))[0].content, 'Persistent project context.');
    assert.deepEqual(await reloaded.readSelected([saved.id], 'conversation', 'nova'), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('file store replaces same-name files, toggles context, and deletes content', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nafis-files-'));
  try {
    const store = new FileStore(root);
    await store.saveBuffer(Buffer.from('old'), { name: 'notes.txt', scope: 'conversation', scopeId: '42' });
    const current = await store.saveBuffer(Buffer.from('new'), { name: 'notes.txt', scope: 'conversation', scopeId: '42' });
    assert.equal((await store.list('conversation', '42')).length, 1);
    assert.equal((await store.readSelected([current.id]))[0].content, 'new');
    await store.update(current.id, { included: false });
    assert.deepEqual(await store.readSelected([current.id]), []);
    assert.equal(await store.remove(current.id), true);
    assert.deepEqual(await store.list('conversation', '42'), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
