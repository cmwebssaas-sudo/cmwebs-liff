import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { dirname, basename, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInitialState } from './domain.mjs';

function invalid() { throw Object.assign(new Error('Invalid local snapshot'), { code: 'INVALID_SNAPSHOT' }); }
function validateJson(value, key = '') {
  if (key.endsWith('_twd') && (!Number.isSafeInteger(value) || value < 0)) invalid();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid();
    return;
  }
  if (Array.isArray(value)) { value.forEach(item => validateJson(item)); return; }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) invalid();
  for (const [name, item] of Object.entries(value)) validateJson(item, name);
}

/** Validate every table and JSON value before any bytes are written. Domain transitions
 * retain responsibility for action-specific relationships and permission checks. */
function validateSnapshot(state) {
  const template = createInitialState();
  if (!state || state.schema_version !== 1 || Object.keys(state).length !== Object.keys(template).length) invalid();
  validateJson(state);
  for (const table of Object.keys(template).filter(key => key !== 'schema_version')) {
    if (!Array.isArray(state[table])) invalid();
    const ids = new Set();
    for (const row of state[table]) {
      if (!row || Array.isArray(row) || typeof row !== 'object') invalid();
      if (Object.hasOwn(row, 'id')) {
        if (typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) invalid();
        ids.add(row.id);
      }
      for (const key of ['workspace_id', 'actor_id', 'partner_id', 'work_order_id']) {
        if (Object.hasOwn(row, key) && (typeof row[key] !== 'string' || !row[key].trim())) invalid();
      }
    }
  }
  return state;
}

/** One store owns one file. Writers in this instance run serially; callers must not
 * open competing writer instances/processes for the same file. Reads are detached. */
export function createWorkOrderStore({ filePath } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('filePath is required');
  const target = resolve(filePath);
  let snapshot;
  let queue = Promise.resolve();
  let loading;
  function load() {
    loading ??= (async () => {
      try { snapshot = validateSnapshot(JSON.parse(await readFile(target, 'utf8'))); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        snapshot = createInitialState();
      }
    })();
    return loading;
  }
  async function readSnapshot() {
    await queue;
    await load();
    return structuredClone(snapshot);
  }
  function transact(mutator) {
    const transaction = queue.then(async () => {
      await load();
      const candidate = validateSnapshot(await mutator(structuredClone(snapshot)));
      // Detach before awaiting IO, so a retained mutator reference cannot change
      // the validated bytes or the committed in-memory snapshot.
      const committed = JSON.parse(JSON.stringify(candidate));
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      const temp = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
      let handle;
      try {
        handle = await open(temp, 'wx', 0o600);
        await handle.writeFile(JSON.stringify(committed) + '\n', 'utf8');
        await handle.sync();
        await handle.close();
        handle = undefined;
        await rename(temp, target);
        snapshot = committed;
        return structuredClone(committed);
      } finally {
        await handle?.close().catch(() => {});
        await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
    });
    queue = transaction.catch(() => {});
    return transaction;
  }
  return { readSnapshot, transact };
}
