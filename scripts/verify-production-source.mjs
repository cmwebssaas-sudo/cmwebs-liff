import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/production-baseline.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--live') continue;
  if (args[i] === '--export' && args[i + 1] && !args[i + 1].startsWith('--')) { i++; continue; }
  fail('Usage: node scripts/verify-production-source.mjs [--live] [--export DIRECTORY]');
}

function inventory(directory) {
  const files = fs.readdirSync(directory).filter(name => /\.(js|gs|json)$/.test(name) && !name.startsWith('.')).sort();
  const tree = files.map(name => name + '\0' + hash(fs.readFileSync(path.join(directory, name))) + '\n').join('');
  return { files, digest: hash(tree) };
}

const backend = path.join(root, 'apps-script');
const local = inventory(backend);
for (const name of local.files) {
  const file = path.join(backend, name);
  if (name.endsWith('.json')) { JSON.parse(fs.readFileSync(file, 'utf8')); continue; }
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) fail(`${name}: ${checked.stderr}`);
}
const pages = fs.readdirSync(root).filter(name => /\.(html|js)$/.test(name));
let endpointCount = 0;
for (const name of pages) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  for (const match of source.matchAll(/https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec/g)) {
    if (hash(match[1]) !== baseline.deployment_sha256) fail(`${name}: unexpected Web App deployment; reconcile against the live site before release.`);
    endpointCount++;
  }
}
if (!endpointCount) fail('No production endpoint found.');
console.log(`PASS: ${local.files.length} backend files parsed; ${endpointCount} endpoint references match the recorded deployment.`);

const exportIndex = args.indexOf('--export');
if (exportIndex >= 0) {
  const directory = path.resolve(args[exportIndex + 1]);
  const binding = JSON.parse(fs.readFileSync(path.join(directory, '.clasp.json'), 'utf8'));
  if (hash(binding.scriptId || '') !== baseline.project_sha256) fail('Export belongs to another Apps Script project.');
  const exported = inventory(directory);
  if (exported.files.length !== baseline.backend_file_count || exported.digest !== baseline.backend_tree_sha256) fail('Export differs from the recorded immutable serving source. Reconcile the version before release.');
  if (local.digest !== exported.digest) fail('Local backend differs from the serving export. Review the intended change before release.');
  console.log(`PASS: export project and all ${exported.files.length} files match the recorded v${baseline.backend_version} baseline and local source.`);
  console.log('The export check does not prove the current deployment version; also read clasp list-deployments for the verified project.');
}

if (args.includes('--live')) {
  for (const name of baseline.public_files) {
    if (!fs.existsSync(path.join(root, name))) fail(`${name}: manifest references a missing local file.`);
  }
  const results = await Promise.allSettled(baseline.public_files.map(async name => {
    const response = await fetch(new URL(name, baseline.site), { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!response.ok) fail(`${name}: HTTP ${response.status}`);
    const served = Buffer.from(await response.arrayBuffer());
    if (hash(served) !== hash(fs.readFileSync(path.join(root, name)))) fail(`${name}: public content differs from this checkout.`);
    return name;
  }));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) fail(failures.map(result => result.reason.message).join('\n'));
  console.log(`PASS: ${results.length} public files are byte-identical to this checkout. Authenticated transactions and Sheet schema are not tested.`);
}
