import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../landlord-billing.html', import.meta.url),
  'utf8'
);

assert.match(
  source,
  /\.app-shell\.keyboard-open\s+\.action-bar\s*\{\s*display:\s*none\s*;/,
  'the fixed create-bills action bar must not cover a focused meter field'
);

assert.match(
  source,
  /\.app-shell\.keyboard-open\s+\.bottom-nav\s*\{\s*display:\s*none\s*;/,
  'the bottom navigation must not cover a focused field while the keyboard is open'
);

assert.match(
  source,
  /appShell\.classList\.toggle\(\s*'keyboard-open'[\s\S]*?window\.innerHeight\s*-\s*height\s*>\s*120/,
  'visual viewport changes must mark the shell as keyboard-open'
);

assert.match(
  source,
  /document\.addEventListener\(\s*'focusin'[\s\S]*?target\.scrollIntoView\(\{\s*block:\s*'center'/,
  'focusing a meter input must scroll it into the visible viewport'
);

console.log('Phase 221 landlord billing keyboard UI tests passed.');
