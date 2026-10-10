#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const CANONICAL_FINGERPRINTS = Object.freeze({
  script: '601b2190f15a93eb5bbcbb1ade48922b1352825d32bb01add37c28ca1f8fa985',
  deployment: 'ebd02787d83c57d00096d95c3280254e609d051b5d1367da556871192105a390',
});

const IDENTIFIER_PATTERNS = Object.freeze({
  script: /^1[A-Za-z0-9_-]{20,}$/,
  deployment: /^AKfycb[A-Za-z0-9_-]{20,}$/,
});

export function maskFingerprint(fingerprint) {
  return `${fingerprint.slice(0, 6)}...${fingerprint.slice(-6)}`;
}

export function verifyIdentifier(kind, rawIdentifier, expectedFingerprint = CANONICAL_FINGERPRINTS[kind]) {
  const normalized = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : '';

  if (!IDENTIFIER_PATTERNS[kind]?.test(normalized)) {
    return { result: 'INVALID_INPUT' };
  }

  const fingerprint = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return {
    result: fingerprint === expectedFingerprint ? 'MATCH' : 'MISMATCH',
    fingerprint: maskFingerprint(fingerprint),
  };
}

export function formatResult(kind, verification) {
  const prefix = kind === 'script' ? 'SCRIPT_ID' : 'DEPLOYMENT_ID';
  const lines = [`${prefix}=${verification.result}`];
  if (verification.fingerprint) {
    lines.push(`${prefix}_FINGERPRINT=${verification.fingerprint}`);
  }
  return lines.join('\n');
}

export async function readIdentifiers(input) {
  const readline = createInterface({ input, crlfDelay: Infinity, terminal: false });
  const values = [];
  for await (const line of readline) {
    values.push(line);
    if (values.length === 2) {
      readline.close();
      break;
    }
  }
  return values;
}

export async function main({ input = process.stdin, output = process.stdout } = {}) {
  const [scriptId = '', deploymentId = ''] = await readIdentifiers(input);
  const script = verifyIdentifier('script', scriptId);
  const deployment = verifyIdentifier('deployment', deploymentId);

  output.write(`${formatResult('script', script)}\n${formatResult('deployment', deployment)}\n`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  await main();
}
