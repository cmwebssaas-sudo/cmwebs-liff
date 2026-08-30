import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ignorePath = join(root, '.claspignore');

assert.equal(
  existsSync(ignorePath),
  true,
  'Apps Script releases must define an explicit push boundary'
);

const rules = readFileSync(ignorePath, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

assert.deepEqual(
  rules,
  ['**/*', '!apps-script/**'],
  'only canonical apps-script sources may be uploaded to Apps Script'
);

console.log('Phase 179 Apps Script push-boundary tests passed.');
