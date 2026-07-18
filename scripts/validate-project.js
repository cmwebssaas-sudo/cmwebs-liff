#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);

function readOption(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function hasOption(name) {
  return args.includes(name);
}

const root = path.resolve(readOption('--root', process.cwd()));
const appsDir = path.resolve(root, readOption('--apps-dir', 'apps-script'));
const htmlDir = path.resolve(root, readOption('--html-dir', '.'));
const expectedRouteCount = Number(readOption('--expected-routes', '68'));
const allowMissingManifest = hasOption('--allow-missing-manifest');
const errors = [];
const warnings = [];

function relative(filePath) {
  return path.relative(root, filePath) || '.';
}

function flatFiles(directory, extensions) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name))
    .filter((filePath) => extensions.includes(path.extname(filePath).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}

function nodeCheck(source, label) {
  const temporaryFile = path.join(
    os.tmpdir(),
    `cmwebs-check-${process.pid}-${Math.random().toString(16).slice(2)}.js`
  );

  try {
    fs.writeFileSync(temporaryFile, source, 'utf8');
    const result = spawnSync(process.execPath, ['--check', temporaryFile], {
      encoding: 'utf8'
    });

    if (result.status !== 0) {
      errors.push(`${label}: JavaScript syntax check failed`);
      return false;
    }
    return true;
  } finally {
    if (fs.existsSync(temporaryFile)) {
      fs.unlinkSync(temporaryFile);
    }
  }
}

function extractInlineScripts(html) {
  const scripts = [];
  const pattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    if (match[1].trim()) {
      scripts.push(match[1]);
    }
  }

  return scripts.join('\n');
}

function maskCommentsAndStrings(source) {
  let output = '';
  let state = 'normal';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (character === '\n') {
        state = 'normal';
        output += '\n';
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        output += '  ';
        index += 1;
        state = 'normal';
      } else {
        output += character === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (state === 'single' || state === 'double' || state === 'template') {
      const terminator = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (character === '\\') {
        output += ' ';
        if (index + 1 < source.length) {
          output += source[index + 1] === '\n' ? '\n' : ' ';
          index += 1;
        }
      } else if (character === terminator) {
        output += ' ';
        state = 'normal';
      } else {
        output += character === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (character === '/' && next === '/') {
      output += '  ';
      index += 1;
      state = 'line-comment';
    } else if (character === '/' && next === '*') {
      output += '  ';
      index += 1;
      state = 'block-comment';
    } else if (character === "'") {
      output += ' ';
      state = 'single';
    } else if (character === '"') {
      output += ' ';
      state = 'double';
    } else if (character === '`') {
      output += ' ';
      state = 'template';
    } else {
      output += character;
    }
  }

  return output;
}

function topLevelDeclarations(source, filePath) {
  const masked = maskCommentsAndStrings(source);
  const lines = masked.split(/\r?\n/);
  const declarations = [];
  let braceDepth = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (braceDepth === 0) {
      const functionMatch = line.match(
        /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/
      );
      const variableMatch = line.match(
        /^\s*(const|let|var)\s+([A-Za-z_$][\w$]*)\b/
      );

      if (functionMatch) {
        declarations.push({
          kind: 'function',
          name: functionMatch[1],
          filePath,
          line: lineIndex + 1
        });
      }
      if (variableMatch) {
        declarations.push({
          kind: variableMatch[1],
          name: variableMatch[2],
          filePath,
          line: lineIndex + 1
        });
      }
    }

    for (const character of line) {
      if (character === '{') {
        braceDepth += 1;
      } else if (character === '}') {
        braceDepth -= 1;
        if (braceDepth < 0) {
          braceDepth = 0;
        }
      }
    }
  }

  return declarations;
}

function duplicateRouteNames(routes) {
  const counts = new Map();
  for (const route of routes) {
    counts.set(route, (counts.get(route) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([route]) => route)
    .sort();
}

function extractRoutes(dispatcherSource) {
  return [...dispatcherSource.matchAll(/v2Action\s*===\s*['"]([^'"]+)['"]/g)]
    .map((match) => ({ name: match[1], index: match.index }));
}

function resolveFirstLevelHandler(segment, topLevelFunctions) {
  const directPatterns = [
    /(?:const|let|var)\s+(?:result|response|data)\s*=\s*([A-Za-z_$][\w$]*)\s*\(/,
    /return\s+(?:jsonOutput_|htmlBridgeOutput_)\s*\(\s*([A-Za-z_$][\w$]*)\s*\(/
  ];

  for (const pattern of directPatterns) {
    const match = segment.match(pattern);
    if (match && topLevelFunctions.has(match[1])) {
      return match[1];
    }
  }

  const ignored = new Set([
    'jsonOutput_',
    'htmlBridgeOutput_',
    'String',
    'Number',
    'Boolean',
    'JSON',
    'Date',
    'Object',
    'Array'
  ]);

  for (const match of segment.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = match[1];
    if (!ignored.has(name) && topLevelFunctions.has(name)) {
      return name;
    }
  }

  return null;
}

function isPlaceholder(value) {
  return /^(?:REPLACE_ME|CHANGE_ME|CHANGEME|YOUR_[A-Z0-9_]+|EXAMPLE|<[^>]+>)$/i
    .test(value.trim());
}

function credentialType(variableName) {
  const normalized = variableName.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  const types = [
    ['privatekey', 'private key'],
    ['serviceaccount', 'service account'],
    ['webhooksecret', 'webhook secret'],
    ['channelsecret', 'channel secret'],
    ['channeltoken', 'channel token'],
    ['accesstoken', 'access token'],
    ['bearertoken', 'bearer token'],
    ['clientsecret', 'client secret'],
    ['apikey', 'API key'],
    ['paymentcredential', 'payment credential'],
    ['merchantid', 'payment merchant identifier'],
    ['hashkey', 'payment hash key'],
    ['hashiv', 'payment hash IV'],
    ['password', 'password'],
    ['spreadsheetid', 'spreadsheet identifier'],
    ['credential', 'credential']
  ];

  const match = types.find(([needle]) => normalized.includes(needle));
  return match ? match[1] : null;
}

function shannonEntropy(value) {
  const counts = new Map();
  for (const character of value) {
    counts.set(character, (counts.get(character) || 0) + 1);
  }
  return [...counts.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

function scanCredentials(files) {
  const blocking = [];
  const review = [];
  const seen = new Set();
  const globalPatterns = [
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['bearer token', /Bearer\s+[A-Za-z0-9._~+\/-]{20,}/g],
    ['Google API key', /AIza[0-9A-Za-z_-]{30,}/g],
    ['JWT', /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
    ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/g],
    ['Slack token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
    ['AWS access key', /AKIA[0-9A-Z]{16}/g],
    ['hardcoded LINE UID', /\bU[0-9a-fA-F]{32}\b/g]
  ];

  function addFinding(target, filePath, line, variable, type) {
    const key = `${filePath}:${line}:${variable}:${type}`;
    if (!seen.has(key)) {
      seen.add(key);
      target.push({ filePath, line, variable, type });
    }
  }

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split(/\r?\n/);

    for (const [type, pattern] of globalPatterns) {
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split('\n').length;
        addFinding(blocking, filePath, line, '(pattern match)', type);
      }
    }

    const declarationPattern =
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"]*)\2/g;
    for (const match of source.matchAll(declarationPattern)) {
      const variable = match[1];
      const value = match[3];
      if (!value || isPlaceholder(value)) {
        continue;
      }
      const line = source.slice(0, match.index).split('\n').length;
      const type = credentialType(variable);
      if (type) {
        addFinding(blocking, filePath, line, variable, type);
      } else if (
        value.length >= 32 &&
        !/\s/.test(value) &&
        shannonEntropy(value) >= 4.4 &&
        !/^(?:https?:|\/)/i.test(value) &&
        !/(?:url|liff|action|sheet|view)/i.test(variable)
      ) {
        addFinding(
          review,
          filePath,
          line,
          variable,
          'high-entropy literal'
        );
      }
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const assignment = line.match(
        /(?:^|[,{]\s*)([A-Za-z_$][\w$]*)\s*:\s*(['"])([^'"]*)\2/
      );
      if (!assignment || !assignment[3] || isPlaceholder(assignment[3])) {
        continue;
      }

      const variable = assignment[1];
      const value = assignment[3];
      const type = credentialType(variable);

      if (type) {
        addFinding(blocking, filePath, index + 1, variable, type);
      }
    }
  }

  return { blocking, review };
}

function checkHtmlLinks(htmlFiles) {
  const available = new Set(htmlFiles.map((filePath) => path.basename(filePath)));
  const missing = [];
  let checked = 0;

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const targets = new Set();

    for (const match of html.matchAll(/['"]([^'"]+\.html(?:[?#][^'"]*)?)['"]/gi)) {
      const rawTarget = match[1];
      if (
        /^(?:https?:|\/\/|\/)/i.test(rawTarget) ||
        rawTarget.includes('${')
      ) {
        continue;
      }
      const target = rawTarget.split(/[?#]/)[0].replace(/^\.\//, '');
      if (!target || target.includes('/')) {
        continue;
      }
      targets.add(target);
    }

    for (const target of targets) {
      checked += 1;
      if (!available.has(target)) {
        missing.push(`${relative(filePath)} -> ${target}`);
      }
    }
  }

  return { checked, missing };
}

const appFiles = flatFiles(appsDir, ['.js', '.gs']);
const htmlFiles = flatFiles(htmlDir, ['.html']);

if (appFiles.length === 0) {
  errors.push(`No Apps Script .js or .gs files found: ${relative(appsDir)}`);
}
if (htmlFiles.length === 0) {
  errors.push(`No repository HTML files found: ${relative(htmlDir)}`);
}

const declarations = [];
for (const filePath of appFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  nodeCheck(source, relative(filePath));
  declarations.push(...topLevelDeclarations(source, filePath));
}

for (const filePath of htmlFiles) {
  const inline = extractInlineScripts(fs.readFileSync(filePath, 'utf8'));
  if (inline.trim()) {
    nodeCheck(inline, relative(filePath));
  }
}

const forbiddenPattern =
  /(?:_FIXED|_WITH_[A-Z0-9_]+|(?:^|[-_])fixed(?:[-_.]|$)|^Code-complete-)/i;
for (const filePath of [...appFiles, ...htmlFiles]) {
  if (forbiddenPattern.test(path.basename(filePath))) {
    errors.push(`Variant filename is forbidden: ${relative(filePath)}`);
  }
}

const declarationOwners = new Map();
for (const declaration of declarations) {
  if (!declarationOwners.has(declaration.name)) {
    declarationOwners.set(declaration.name, []);
  }
  declarationOwners.get(declaration.name).push(declaration);
}

const duplicateCounts = { function: 0, const: 0, let: 0, var: 0 };
for (const [name, owners] of declarationOwners.entries()) {
  if (owners.length > 1) {
    for (const kind of new Set(owners.map((owner) => owner.kind))) {
      duplicateCounts[kind] += 1;
    }
    errors.push(
      `Duplicate top-level declaration ${name}: ` +
      owners.map((owner) => `${relative(owner.filePath)}:${owner.line}`).join(', ')
    );
  }
}

const dispatcherCandidates = [
  path.join(appsDir, '程式碼.js'),
  path.join(appsDir, 'Code.gs'),
  path.join(appsDir, 'Code.js')
].filter((filePath) => fs.existsSync(filePath));

if (dispatcherCandidates.length !== 1) {
  errors.push(
    `Expected exactly one dispatcher (程式碼.js, Code.gs, or Code.js); found ${dispatcherCandidates.length}`
  );
}

let routeRecords = [];
let routeDuplicates = [];
let handlerCoverage = { covered: 0, total: 0, missing: [] };
const topLevelFunctions = new Set(
  declarations
    .filter((declaration) => declaration.kind === 'function')
    .map((declaration) => declaration.name)
);

if (dispatcherCandidates.length === 1) {
  const dispatcherSource = fs.readFileSync(dispatcherCandidates[0], 'utf8');
  routeRecords = extractRoutes(dispatcherSource);
  routeDuplicates = duplicateRouteNames(routeRecords.map((route) => route.name));

  if (routeDuplicates.length > 0) {
    errors.push(`Duplicate v2_action routes: ${routeDuplicates.join(', ')}`);
  }
  if (routeRecords.length !== expectedRouteCount) {
    errors.push(
      `Route count mismatch: expected ${expectedRouteCount}, found ${routeRecords.length}`
    );
  }

  const uniqueRouteCount = new Set(routeRecords.map((route) => route.name)).size;
  if (uniqueRouteCount !== expectedRouteCount) {
    errors.push(
      `Unique route count mismatch: expected ${expectedRouteCount}, found ${uniqueRouteCount}`
    );
  }

  const missingHandlers = [];
  for (let index = 0; index < routeRecords.length; index += 1) {
    const start = routeRecords[index].index;
    const end = index + 1 < routeRecords.length
      ? routeRecords[index + 1].index
      : dispatcherSource.length;
    const segment = dispatcherSource.slice(start, end);
    const handler = resolveFirstLevelHandler(segment, topLevelFunctions);
    if (!handler) {
      missingHandlers.push(routeRecords[index].name);
    }
  }

  handlerCoverage = {
    covered: routeRecords.length - missingHandlers.length,
    total: routeRecords.length,
    missing: missingHandlers
  };
  if (missingHandlers.length > 0) {
    errors.push(`Routes without a first-level handler: ${missingHandlers.join(', ')}`);
  }
}

const commonHelpers = [
  'jsonOutput_',
  'htmlBridgeOutput_',
  'handleLineWebhook_',
  'pushLineTextMessage_',
  'cmwebsLogLineMessage_',
  'getSheetObjects_',
  'logLiffAccess_'
];
const missingHelpers = commonHelpers.filter((helper) => !topLevelFunctions.has(helper));
if (missingHelpers.length > 0) {
  errors.push(`Missing common helpers: ${missingHelpers.join(', ')}`);
}

const manifestPath = path.join(appsDir, 'appsscript.json');
let manifestStatus = 'PASS';
if (!fs.existsSync(manifestPath)) {
  manifestStatus = allowMissingManifest ? 'SKIPPED' : 'FAIL';
  const message = `Missing appsscript.json: ${relative(manifestPath)}`;
  if (allowMissingManifest) {
    warnings.push(message);
  } else {
    errors.push(message);
  }
} else {
  try {
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_error) {
    manifestStatus = 'FAIL';
    errors.push(`Invalid appsscript.json JSON: ${relative(manifestPath)}`);
  }
}

const gitResult = spawnSync('git', ['-C', root, 'ls-files', '-z'], {
  encoding: 'utf8'
});
if (gitResult.status !== 0) {
  errors.push('Unable to verify whether .clasp.json is Git-tracked');
} else {
  const trackedClaspFiles = gitResult.stdout
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => ['.clasp.json', '.clasprc.json'].includes(path.basename(filePath)));
  if (trackedClaspFiles.length > 0) {
    errors.push(`Git-tracked clasp credentials/config: ${trackedClaspFiles.join(', ')}`);
  }
}

const localClaspPath = path.join(appsDir, '.clasp.json');
if (fs.existsSync(localClaspPath)) {
  warnings.push(`Local .clasp.json is present but must remain ignored: ${relative(localClaspPath)}`);
}

const credentialFindings = scanCredentials(appFiles);
const hardcodedLineUidCount = credentialFindings.blocking
  .filter((finding) => finding.type === 'hardcoded LINE UID')
  .length;
for (const finding of credentialFindings.blocking) {
  errors.push(
    `Credential-like literal: ${relative(finding.filePath)}:${finding.line} ` +
    `${finding.variable} (${finding.type})`
  );
}
for (const finding of credentialFindings.review) {
  warnings.push(
    `Review-only identifier: ${relative(finding.filePath)}:${finding.line} ` +
    `${finding.variable} (${finding.type})`
  );
}

const htmlLinks = checkHtmlLinks(htmlFiles);
for (const missingLink of htmlLinks.missing) {
  errors.push(`Missing repository HTML link target: ${missingLink}`);
}

const uniqueRoutes = new Set(routeRecords.map((route) => route.name)).size;
console.log(`Apps Script files: ${appFiles.length}`);
console.log(`HTML files: ${htmlFiles.length}`);
console.log(
  `Routes: ${routeRecords.length} (unique ${uniqueRoutes}, duplicates ${routeDuplicates.length})`
);
console.log(
  `Handler coverage: ${handlerCoverage.covered}/${handlerCoverage.total}`
);
console.log(
  `Common helper coverage: ${commonHelpers.length - missingHelpers.length}/${commonHelpers.length}`
);
console.log(
  'Duplicate top-level declarations: ' +
  `function=${duplicateCounts.function}, const=${duplicateCounts.const}, ` +
  `let=${duplicateCounts.let}, var=${duplicateCounts.var}`
);
console.log(
  `Credential scan: blocking=${credentialFindings.blocking.length}, ` +
  `review-only=${credentialFindings.review.length}`
);
console.log(`Hardcoded LINE UID: ${hardcodedLineUidCount}`);
console.log(`Manifest: ${manifestStatus}`);
console.log(
  `HTML links: checked=${htmlLinks.checked}, missing=${htmlLinks.missing.length}`
);

for (const warning of warnings) {
  console.warn(`WARNING: ${warning}`);
}

if (errors.length > 0) {
  console.error('Validation: FAIL');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Validation: PASS');
console.log('CMWebs validation passed.');
