import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function sqliteD1(initial = []) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../_dev/vendor-work-orders-cloud/migrations/0001_vendor_work_orders.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../_dev/vendor-work-orders-cloud/migrations/0002_commit_revision.sql', import.meta.url), 'utf8'));
  for (const row of initial) sqlite.prepare('INSERT INTO vendor_work_orders_rows VALUES (?, ?, ?, ?, ?)').run(row.table_name, row.row_id, JSON.parse(row.payload_json).workspace_id || null, row.payload_json, '2026-10-10');
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT'); return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    seedAuth(key, value) { sqlite.prepare('INSERT INTO vendor_work_orders_auth VALUES (?, ?, ?, ?, ?)').run(key, value.kind, value.payload_json, value.expires_at, Date.now()); },
  };
  return db;
}
