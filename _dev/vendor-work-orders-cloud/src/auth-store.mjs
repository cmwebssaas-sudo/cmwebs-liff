function clone(value) { return structuredClone(value); }

export function createAuthStore({ db, clock = () => Date.now() }) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('D1 binding is required');
  async function put(kind, keyHash, payload, expiresAt) {
    await db.prepare(`INSERT INTO vendor_work_orders_auth (key_hash, kind, payload_json, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(key_hash) DO UPDATE SET kind = excluded.kind, payload_json = excluded.payload_json,
      expires_at = excluded.expires_at`).bind(keyHash, kind, JSON.stringify(payload), expiresAt, Number(clock())).run();
  }
  async function get(kind, keyHash) {
    const row = await db.prepare('SELECT kind, payload_json, expires_at FROM vendor_work_orders_auth WHERE key_hash = ?1').bind(keyHash).first();
    if (!row || row.kind !== kind || Number(row.expires_at) <= Number(clock())) {
      if (row) await remove(keyHash);
      return null;
    }
    try { return { payload: clone(JSON.parse(row.payload_json)), expires_at: Number(row.expires_at) }; }
    catch { return null; }
  }
  async function remove(keyHash) {
    await db.prepare('DELETE FROM vendor_work_orders_auth WHERE key_hash = ?1').bind(keyHash).run();
  }
  return { put, get, remove };
}
