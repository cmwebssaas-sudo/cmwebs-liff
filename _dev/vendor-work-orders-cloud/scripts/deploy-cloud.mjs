import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = resolve(root, 'wrangler.jsonc');
const expectedWorker = 'vendor-work-orders-staging';
const expectedDb = 'vendor-work-orders-staging';
const expectedBucket = 'vendor-work-orders-attachments-staging';
const domain = 'workorders-test.cmwebs.com';

function run(args) {
  const result = spawnSync('npx', ['--yes', 'wrangler@4.149.0', ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const text = await readFile(config, 'utf8');
if (!text.includes(`"name": "${expectedWorker}"`) || !text.includes(`"database_name": "${expectedDb}"`) ||
    !text.includes(`"bucket_name": "${expectedBucket}"`) || !text.includes(domain) || text.includes('REPLACE_AFTER_')) {
  throw new Error('Deployment guard rejected: staging resource names or hostname do not match the approved target.');
}
if (process.env.CLOUDFLARE_API_TOKEN || process.env.LINE_CHANNEL_SECRET) {
  throw new Error('Deployment guard rejected: secrets must be entered with Wrangler secret put, never passed through this script.');
}

run(['d1', 'migrations', 'apply', expectedDb, '--remote', '--config', config]);
run(['deploy', '--config', config, '--domains', domain]);
