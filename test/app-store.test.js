const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { AppStore } = require('../lib/app-store');

test('app store persists UI state and connector config without dropping existing data', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'nafis-app-store-'));
  const storePath = path.join(dir, 'store.json');
  await fsp.writeFile(storePath, JSON.stringify({ projects: [{ id: 'legacy-project' }] }), 'utf8');

  const store = new AppStore(storePath);
  await store.saveAppState({
    apiKeysByModel: { sonnet: ['key-1', 'key-2'] },
    conversations: [{ id: 1, title: 'Backend state' }],
    globalMemory: 'Remember this.',
  });
  await store.saveConnector('atlassian', {
    connected: true,
    baseUrl: 'https://example.atlassian.net',
    email: 'user@example.com',
    apiToken: 'token',
  });

  const raw = JSON.parse(await fsp.readFile(storePath, 'utf8'));
  assert.deepEqual(raw.projects, [{ id: 'legacy-project' }]);
  assert.deepEqual((await store.getAppState()).apiKeysByModel.sonnet, ['key-1', 'key-2']);
  assert.equal((await store.getConnector('atlassian')).apiToken, 'token');
});
