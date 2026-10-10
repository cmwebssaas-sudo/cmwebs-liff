import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import {
  main,
  verifyIdentifier,
} from '../tools/verify-production-identity-fingerprint.mjs';

const scriptFixture = `1${'a'.repeat(24)}`;
const deploymentFixture = `AKfycb${'b'.repeat(24)}`;
const fingerprint = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

assert.equal(verifyIdentifier('script', scriptFixture, fingerprint(scriptFixture)).result, 'MATCH');
assert.equal(verifyIdentifier('deployment', deploymentFixture, fingerprint(deploymentFixture)).result, 'MATCH');
assert.equal(verifyIdentifier('script', `${scriptFixture}x`, fingerprint(scriptFixture)).result, 'MISMATCH');
assert.equal(verifyIdentifier('deployment', 'invalid', fingerprint(deploymentFixture)).result, 'INVALID_INPUT');

let captured = '';
const output = new Writable({
  write(chunk, encoding, callback) {
    captured += chunk.toString();
    callback();
  },
});
await main({ input: Readable.from([`${scriptFixture}\n${deploymentFixture}\n`]), output });
assert.match(captured, /SCRIPT_ID=MISMATCH/);
assert.match(captured, /DEPLOYMENT_ID=MISMATCH/);
assert.ok(!captured.includes(scriptFixture));
assert.ok(!captured.includes(deploymentFixture));
assert.match(captured, /[a-f0-9]{6}\.\.\.[a-f0-9]{6}/);

process.stdout.write('verify-production-identity-fingerprint: PASS\n');
