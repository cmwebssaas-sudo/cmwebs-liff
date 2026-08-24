import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const htmlSource = readFileSync('tenant-bind.html', 'utf8');

assert.match(htmlSource, /function jsonpRequestOnce\(/);
assert.match(htmlSource, /function jsonpRequest\(/);
assert.match(htmlSource, /JSONP_REQUEST_TIMEOUT_MS\s*=\s*30000/);
assert.match(htmlSource, /JSONP_REQUEST_MAX_ATTEMPTS\s*=\s*2/);
assert.match(htmlSource, /retryOnTimeout:\s*true/);

const submitCall = htmlSource.match(
  /await jsonpRequest\(\s*'tenant_bind_submit'[\s\S]*?\);/s
)?.[0] || '';
assert.match(submitCall, /normalizedPhone/);
assert.doesNotMatch(submitCall, /retryOnTimeout|maxAttempts/);

console.log('Tenant binding API resilience tests passed.');
