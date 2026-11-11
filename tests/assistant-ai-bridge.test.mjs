import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('AI-00 assistant bridge unit tests pass', () => {
  const run = spawnSync('python3', ['-m', 'unittest', '-q', 'test_cmwebs_assistant_bridge'], {
    cwd: new URL('../ai-bridge/', import.meta.url),
    encoding: 'utf8',
    timeout: 60000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
