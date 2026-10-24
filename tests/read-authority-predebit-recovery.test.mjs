import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('native predebit recovery transaction remains fail closed across crashes', () => {
  const result=spawnSync('python3',[fileURLToPath(new URL('./read-authority-predebit-recovery.test.py',import.meta.url))],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
