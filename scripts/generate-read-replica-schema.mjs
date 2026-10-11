import { readFile, writeFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const schema = JSON.parse(await readFile(new URL('cloudflare/read-api/schema.json', root), 'utf8'));
const forbidden = /bank|identity|id_number|document|file|token(?!_hash$)|code_hash|claim_code|terms_snapshot/i;
for (const [name, table] of Object.entries(schema)) {
  if (!/^V2_[a-z_]+$/.test(name) || !table.fields.includes(table.key) || table.fields.length > 97) throw new Error('Invalid table');
  for (const field of table.fields) {
    // Permission booleans are authorization data, never bank account values.
    const safeBankMetadata = name === 'V2_payment_accounts' && ['bank_code','bank_name','bank_account_last5'].includes(field);
    if (!/^[a-z_][a-z0-9_]*$/.test(field) || (forbidden.test(field) && !safeBankMetadata && !['can_edit_bank_account', 'profile_display_name', 'profile_picture_url', 'session_token_hash'].includes(field))) throw new Error('Forbidden field: ' + field);
  }
  if (table.computed_fields && JSON.stringify(table.computed_fields)!==JSON.stringify({bank_account_last5:{source:'bank_account',mask:'last5'}})) throw new Error('Unknown projection transform');
  if (table.computed_fields && name!=='V2_payment_accounts') throw new Error('Unexpected projection transform table');
}
const gas = '// Generated from cloudflare/read-api/schema.json; edit that authority and rerun this script.\nconst V2_READ_REPLICA_TABLES_ = ' + JSON.stringify(schema, null, 2) + ';\n';
const tables = Object.entries(schema).map(([name, table]) => `CREATE TABLE "${name}" (\n  row_key TEXT PRIMARY KEY,\n  row_hash TEXT NOT NULL,\n  synced_at TEXT NOT NULL,\n${table.fields.map(field => `  "${field}" TEXT`).join(',\n')}\n);`).join('\n\n');
const metadata = `
CREATE TABLE sync_nonces (nonce TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE sync_runs (
  snapshot_id TEXT PRIMARY KEY, sheet TEXT NOT NULL, mode TEXT NOT NULL,
  source_version INTEGER NOT NULL, batch_count INTEGER NOT NULL,
  row_count INTEGER NOT NULL, snapshot_hash TEXT NOT NULL,
  status TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT
);
CREATE INDEX sync_runs_sheet_version ON sync_runs(sheet, source_version);
CREATE TABLE sync_batches (
  snapshot_id TEXT NOT NULL REFERENCES sync_runs(snapshot_id) ON DELETE CASCADE,
  batch_index INTEGER NOT NULL, batch_hash TEXT NOT NULL,
  PRIMARY KEY(snapshot_id, batch_index)
);
CREATE TABLE sync_staging (
  snapshot_id TEXT NOT NULL REFERENCES sync_runs(snapshot_id) ON DELETE CASCADE,
  row_key TEXT NOT NULL, row_hash TEXT NOT NULL, fields TEXT NOT NULL,
  PRIMARY KEY(snapshot_id, row_key)
);
CREATE TABLE shadow_diffs (
  report_id TEXT PRIMARY KEY, route TEXT NOT NULL, field_path TEXT NOT NULL,
  observed_at TEXT NOT NULL
);
`;
await writeFile(new URL('apps-script/V2_READ_REPLICA_SCHEMA.js', root), gas);
const baselineUrl=new URL('cloudflare/read-api/migrations/0001_read_replica.sql',root);
let baseline;
try { baseline=await readFile(baselineUrl,'utf8'); } catch { baseline=null; }
if (!baseline) {
  await writeFile(baselineUrl, '-- Generated from schema.json; regenerate with scripts/generate-read-replica-schema.mjs.\n'+tables+'\n'+metadata);
} else {
  // Never rewrite the C1 migration after provisioning. Extend it additively.
  const migrationDir=new URL('cloudflare/read-api/migrations/',root);
  const files=(await readdir(migrationDir)).filter(name=>/^\d{4}_.*\.sql$/.test(name)).sort();
  const baselineTables={};
  for(const file of files) {
    const sql=await readFile(new URL(file,migrationDir),'utf8');
    for(const match of sql.matchAll(/CREATE TABLE "(V2_[a-z_]+)" \(([^;]+)\);/g)) {
      if(baselineTables[match[1]]) throw new Error('Duplicate migration table');
      baselineTables[match[1]]=[...match[2].matchAll(/"([a-z_][a-z0-9_]*)" TEXT/g)].map(field=>field[1]);
    }
    for(const match of sql.matchAll(/ALTER TABLE "(V2_[a-z_]+)" ADD COLUMN "([a-z_][a-z0-9_]*)" TEXT;/g)) {
      if(!baselineTables[match[1]]||baselineTables[match[1]].includes(match[2])) throw new Error('Invalid additive migration');
      baselineTables[match[1]].push(match[2]);
    }
  }
  const additions=[];
  if(Object.keys(baselineTables).some(name=>!Object.hasOwn(schema,name))) throw new Error('Table removal requires an explicit migration');
  for(const [name,table] of Object.entries(schema)) {
    if(!baselineTables[name]) additions.push(tables.split('\n\n').find(sql=>sql.startsWith('CREATE TABLE "'+name+'"')));
    else {
      if(baselineTables[name].some(field=>!table.fields.includes(field))) throw new Error('Removal requires an explicit migration');
      for(const field of table.fields.filter(field=>!baselineTables[name].includes(field))) additions.push(`ALTER TABLE "${name}" ADD COLUMN "${field}" TEXT;`);
    }
  }
  if(additions.length) {
    const next=String(Math.max(...files.map(file=>Number(file.slice(0,4))))+1).padStart(4,'0');
    await writeFile(new URL(next+'_read_projection.sql',migrationDir),'-- Generated additive projection extension; existing migrations are immutable.\n'+additions.join('\n\n')+'\n',{flag:'wx'});
  }
}
