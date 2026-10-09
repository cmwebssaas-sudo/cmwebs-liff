import { createInitialState } from '../../vendor-work-orders/domain.mjs';

const domainTables = Object.keys(createInitialState()).filter(name => name !== 'schema_version');

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
  const revisions = new WeakMap();
  // Migrations are applied before deployment. One SQL statement gives every
  // row and its revision the same database snapshot, without per-request DDL.
  async function read() {
    const result = await db.prepare(`SELECT rows.table_name, rows.payload_json,
      (SELECT value FROM vendor_work_orders_meta WHERE key = 'schema_version') AS schema_version,
      COALESCE((SELECT CAST(value AS INTEGER) FROM vendor_work_orders_meta WHERE key = 'revision'), 0) AS revision
      FROM (SELECT 1) AS snapshot LEFT JOIN vendor_work_orders_rows AS rows ON 1 = 1`).all();
    const revision = Number(result.results?.[0]?.revision);
    if (!Number.isSafeInteger(revision) || revision < 0 || Number(result.results?.[0]?.schema_version) !== 1) {
      throw Object.assign(new Error('UNSUPPORTED_SCHEMA'), { code: 'UNSUPPORTED_SCHEMA' });
    }
    const state = createInitialState();
    for (const row of result.results || []) {
      if (!domainTables.includes(row.table_name)) continue;
      let payload;
      try { payload = JSON.parse(row.payload_json); } catch { throw Object.assign(new Error('INVALID_STATE'), { code: 'INVALID_STATE' }); }
      state[row.table_name].push(payload);
    }
    revisions.set(state, revision);
    return state;
  }
  async function write(next, expectedRevision = revisions.get(next)) {
    validateState(next);
    if (!Number.isSafeInteger(expectedRevision)) throw Object.assign(new Error('VERSION_CONFLICT'), { code: 'VERSION_CONFLICT' });
    const statements = [
      db.prepare('DELETE FROM vendor_work_orders_commit_guard'),
      db.prepare(`INSERT INTO vendor_work_orders_commit_guard (id) SELECT CASE WHEN
        COALESCE((SELECT CAST(value AS INTEGER) FROM vendor_work_orders_meta WHERE key = 'revision'), 0) = ?1
        THEN 1 ELSE 0 END`).bind(expectedRevision),
      db.prepare('DELETE FROM vendor_work_orders_rows'),
    ];
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
    statements.push(db.prepare(`INSERT INTO vendor_work_orders_meta (key, value) VALUES ('revision', ?1)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(String(expectedRevision + 1)));
    statements.push(db.prepare('DELETE FROM vendor_work_orders_commit_guard'));
    try { await db.batch(statements); }
    catch (error) {
      if (String(error?.message).includes('revision_guard_ok')) throw Object.assign(new Error('VERSION_CONFLICT'), { code: 'VERSION_CONFLICT' });
      throw error;
    }
    const result = clone(next); revisions.set(result, expectedRevision + 1);
    return result;
  }
  function transact(mutator) {
    const operation = queue.then(async () => {
      const current = await read();
      const candidate = await mutator(clone(current));
      return write(candidate, revisions.get(current));
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read, write, transact };
}
