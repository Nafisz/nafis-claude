const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class AppStore {
  constructor(storePath) {
    this.storePath = storePath;
    this.writeChain = Promise.resolve();
  }

  async ensure() {
    await fsp.mkdir(path.dirname(this.storePath), { recursive: true });
    try {
      await fsp.access(this.storePath);
    } catch {
      await this.writeRaw({});
    }
  }

  async read() {
    await this.ensure();
    try {
      const data = JSON.parse(await fsp.readFile(this.storePath, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  async writeRaw(data) {
    await fsp.mkdir(path.dirname(this.storePath), { recursive: true });
    const tempPath = `${this.storePath}.${crypto.randomUUID()}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(tempPath, this.storePath);
  }

  mutate(mutator) {
    const operation = this.writeChain.then(async () => {
      const data = await this.read();
      const result = await mutator(data);
      data.updatedAt = new Date().toISOString();
      await this.writeRaw(data);
      return result;
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  async getAppState() {
    const data = await this.read();
    return data.appState && typeof data.appState === 'object' ? data.appState : null;
  }

  saveAppState(appState) {
    return this.mutate((data) => {
      data.appState = appState && typeof appState === 'object' ? appState : {};
      data.appStateUpdatedAt = new Date().toISOString();
      return data.appState;
    });
  }

  async getConnector(name) {
    const data = await this.read();
    const connector = data.connectors?.[name];
    return connector && typeof connector === 'object' ? connector : null;
  }

  saveConnector(name, connector) {
    return this.mutate((data) => {
      data.connectors = data.connectors && typeof data.connectors === 'object' ? data.connectors : {};
      data.connectors[name] = connector && typeof connector === 'object' ? connector : {};
      data.connectors[name].updatedAt = new Date().toISOString();
      return data.connectors[name];
    });
  }
}

module.exports = { AppStore };
