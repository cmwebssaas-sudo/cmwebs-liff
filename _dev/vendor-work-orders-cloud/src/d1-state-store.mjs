import { createInitialState } from '../../vendor-work-orders/domain.mjs';

const domainTables = Object.keys(createInitialState()).filter(name => name !== 'schema_version');
const schemaSql = `
  CREATE TABLE IF NOT EXISTS vendor_work_orders_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vendor_work_orders_rows (
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    workspace_id TEXT,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (table_name, row_id)
  );
  CREATE INDEX IF NOT EXISTS idx_vendor_work_orders_rows_workspace
    ON vendor_work_orders_rows (workspace_id, table_name);
`;

function clone(value) { return structuredClone(value); }

function validateState(state) {
  if (!state || state.schema_version !== 1) throw Object.assign(new Error('INVALID_STATE'), { code: 'INVALID_STATE' });
  for (const table of domainTables) {
    if (!Array.isArray(state[table])) throw Object.assign(new Error('INVALID_STATE'), { code: 'INVALID_STATE' });
  }
  return state;
}

function workspaceId(row) {
  return typeof row?.workspace_id === 'string' && row.workspace_id.trim() ? row.workspace_id : null;
}

function rowId(table, row, index) {
  if (typeof row?.id === 'string' && row.id.trim()) return row.id;
  return `${table}-${index + 1}`;
}

export function createD1StateStore({ db, clock = () => new Date().toISOString() }) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') {
    throw new TypeError('D1 binding is required');
  }
  let queue = Promise.resolve();
  async function ensureSchema() {
    for (const statement of schemaSql.split(';').map(value => value.trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
  }
  async function read() {
    await ensureSchema();
    const state = createInitialState();
    const meta = await db.prepare('SELECT value FROM vendor_work_orders_meta WHERE key = ?1').bind('schema_version').first();
    if (meta?.value !== undefined && Number(meta.value) !== 1) {
      throw Object.assign(new Error('UNSUPPORTED_SCHEMA'), { code: 'UNSUPPORTED_SCHEMA' });
    }
    const result = await db.prepare('SELECT table_name, row_id, payload_json FROM vendor_work_orders_rows').all();
    for (const row of result.results || []) {
      if (!domainTables.includes(row.table_name)) continue;
      let payload;
      try { payload = JSON.parse(row.payload_json); } catch { throw Object.assign(new Error('INVALID_STATE'), { code: 'INVALID_STATE' }); }
      state[row.table_name].push(payload);
    }
    return state;
  }
  async function write(next) {
    validateState(next);
    await ensureSchema();
    const statements = [db.prepare('DELETE FROM vendor_work_orders_rows')];
    for (const table of domainTables) {
      next[table].forEach((row, index) => {
        statements.push(db.prepare(`INSERT INTO vendor_work_orders_rows
          (table_name, row_id, workspace_id, payload_json, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5)`)
          .bind(table, rowId(table, row, index), workspaceId(row), JSON.stringify(row), String(clock())));
      });
    }
    statements.push(db.prepare(`INSERT INTO vendor_work_orders_meta (key, value) VALUES (?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind('schema_version', '1'));
    await db.batch(statements);
    return clone(next);
  }
  function transact(mutator) {
    const operation = queue.then(async () => {
      const current = await read();
      const candidate = await mutator(clone(current));
      return write(candidate);
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read, write, transact };
}
