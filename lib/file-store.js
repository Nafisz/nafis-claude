const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Readable, Transform } = require('node:stream');

class FileStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.uploadDir = path.join(rootDir, 'uploads');
    this.indexPath = path.join(rootDir, 'files.json');
    this.writeChain = Promise.resolve();
  }

  async ensure() {
    await fsp.mkdir(this.uploadDir, { recursive: true });
    try {
      await fsp.access(this.indexPath);
    } catch {
      await this.writeIndex({ files: [] });
    }
  }

  async readIndex() {
    await this.ensure();
    try {
      const data = JSON.parse(await fsp.readFile(this.indexPath, 'utf8'));
      return { files: Array.isArray(data.files) ? data.files : [] };
    } catch {
      return { files: [] };
    }
  }

  async writeIndex(data) {
    await fsp.mkdir(this.rootDir, { recursive: true });
    const tempPath = `${this.indexPath}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(tempPath, this.indexPath);
  }

  mutateIndex(mutator) {
    const operation = this.writeChain.then(async () => {
      const index = await this.readIndex();
      const result = await mutator(index);
      await this.writeIndex(index);
      return result;
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  publicRecord(record) {
    if (!record) return null;
    const { storageName, ...publicFields } = record;
    return publicFields;
  }

  async list(scope, scopeId) {
    const index = await this.readIndex();
    return index.files
      .filter((file) => file.scope === scope && file.scopeId === String(scopeId))
      .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)))
      .map((file) => this.publicRecord(file));
  }

  async saveStream(readable, { name, type = 'application/octet-stream', scope, scopeId, included = true }) {
    await this.ensure();
    const id = crypto.randomUUID();
    const storageName = `${id}.upload`;
    const finalPath = path.join(this.uploadDir, storageName);
    const tempPath = `${finalPath}.tmp`;
    let size = 0;
    let newlineCount = 0;
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        size += chunk.length;
        for (const byte of chunk) {
          if (byte === 10) newlineCount += 1;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(readable, meter, fs.createWriteStream(tempPath, { flags: 'wx' }));
      await fsp.rename(tempPath, finalPath);
    } catch (error) {
      await fsp.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }

    const now = new Date().toISOString();
    const record = {
      id,
      name: String(name),
      type: String(type || 'application/octet-stream'),
      size,
      lineCount: size ? newlineCount + 1 : 0,
      scope,
      scopeId: String(scopeId),
      included: Boolean(included),
      addedAt: now,
      updatedAt: now,
      storageName,
    };

    let replaced;
    try {
      replaced = await this.mutateIndex((index) => {
        const previous = index.files.filter((file) => (
          file.scope === scope
          && file.scopeId === String(scopeId)
          && file.name.toLowerCase() === record.name.toLowerCase()
        ));
        index.files = index.files.filter((file) => !previous.some((item) => item.id === file.id));
        index.files.push(record);
        return previous;
      });
    } catch (error) {
      await fsp.rm(finalPath, { force: true }).catch(() => {});
      throw error;
    }
    await Promise.all(replaced.map((file) => fsp.rm(path.join(this.uploadDir, file.storageName), { force: true })));
    return this.publicRecord(record);
  }

  saveBuffer(buffer, metadata) {
    return this.saveStream(Readable.from(buffer), metadata);
  }

  async update(id, patch = {}) {
    return this.mutateIndex((index) => {
      const position = index.files.findIndex((file) => file.id === id);
      if (position < 0) return null;
      index.files[position] = {
        ...index.files[position],
        ...(typeof patch.included === 'boolean' ? { included: patch.included } : {}),
        updatedAt: new Date().toISOString(),
      };
      return this.publicRecord(index.files[position]);
    });
  }

  async remove(id) {
    const removed = await this.mutateIndex((index) => {
      const record = index.files.find((file) => file.id === id);
      if (!record) return null;
      index.files = index.files.filter((file) => file.id !== id);
      return record;
    });
    if (!removed) return false;
    await fsp.rm(path.join(this.uploadDir, removed.storageName), { force: true });
    return true;
  }

  async readSelected(ids = [], scope = null, scopeId = null) {
    const requested = new Set((Array.isArray(ids) ? ids : []).map(String));
    if (!requested.size) return [];
    const index = await this.readIndex();
    const records = index.files.filter((file) => (
      requested.has(file.id)
      && file.included !== false
      && (!scope || file.scope === scope)
      && (scopeId === null || file.scopeId === String(scopeId))
    ));
    return Promise.all(records.map(async (record) => ({
      ...this.publicRecord(record),
      content: await fsp.readFile(path.join(this.uploadDir, record.storageName), 'utf8'),
    })));
  }
}

module.exports = { FileStore };
