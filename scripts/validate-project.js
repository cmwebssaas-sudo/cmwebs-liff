#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let root = process.cwd();
const rootIndex = args.indexOf('--root');

if (rootIndex >= 0 && args[rootIndex + 1]) {
  root = path.resolve(args[rootIndex + 1]);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

let appsDir = path.join(root, 'apps-script');
let publicDir = path.join(root, 'public');
let manifestPath = path.join(root, 'production-manifest.json');

if (!fs.existsSync(appsDir)) {
  appsDir = path.join(root, 'candidate-overlay', 'apps-script');
}

if (!fs.existsSync(publicDir)) {
  publicDir = path.join(root, 'candidate-overlay', 'public');
}

const errors = [];
const warnings = [];

function walk(directory, extension) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const output = [];
  const stack = [directory];

  while (stack.length > 0) {
    const current = stack.pop();

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (!extension || entry.name.endsWith(extension)) {
        output.push(fullPath);
      }
    }
  }

  return output.sort();
}

function nodeCheck(source, label) {
  const tmp = path.join(
    os.tmpdir(),
    `cmwebs-check-${process.pid}-${Math.random().toString(16).slice(2)}.js`
  );

  fs.writeFileSync(tmp, source, 'utf8');

  const result = spawnSync(process.execPath, ['--check', tmp], {
    encoding: 'utf8'
  });

  fs.unlinkSync(tmp);

  if (result.status !== 0) {
    errors.push(`${label}: JavaScript syntax error\n${result.stderr}`);
  }
}

function extractInlineScripts(html) {
  const scripts = [];
  const regex = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (match[1].trim()) {
      scripts.push(match[1]);
    }
  }

  return scripts.join('\n');
}

const gsFiles = walk(appsDir, '.gs');
const htmlFiles = walk(publicDir, '.html');

if (gsFiles.length === 0) {
  errors.push(`No Apps Script files found: ${appsDir}`);
}

if (htmlFiles.length === 0) {
  warnings.push(`No public HTML files found: ${publicDir}`);
}

const functionOwners = new Map();
const constOwners = new Map();

for (const file of gsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);

  nodeCheck(source, relative);

  for (const match of source.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const name = match[1];

    if (!functionOwners.has(name)) {
      functionOwners.set(name, []);
    }

    functionOwners.get(name).push(relative);
  }

  for (const match of source.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
    const name = match[1];

    if (!constOwners.has(name)) {
      constOwners.set(name, []);
    }

    constOwners.get(name).push(relative);
  }
}

for (const [name, owners] of functionOwners.entries()) {
  const uniqueOwners = [...new Set(owners)];

  if (uniqueOwners.length > 1) {
    errors.push(
      `Duplicate top-level function ${name}: ${uniqueOwners.join(', ')}`
    );
  }
}

for (const [name, owners] of constOwners.entries()) {
  const uniqueOwners = [...new Set(owners)];

  if (uniqueOwners.length > 1) {
    errors.push(
      `Duplicate top-level variable ${name}: ${uniqueOwners.join(', ')}`
    );
  }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const inline = extractInlineScripts(html);

  if (inline.trim()) {
    nodeCheck(inline, path.relative(root, file));
  }
}

const forbiddenPattern =
  /(?:_FIXED|_WITH_[A-Z0-9_]+|(?:^|[-_])fixed(?:[-_.]|$)|^Code-complete-)/i;

for (const file of [...gsFiles, ...htmlFiles]) {
  if (forbiddenPattern.test(path.basename(file))) {
    errors.push(
      `Variant filename is forbidden in canonical directories: ${path.relative(root, file)}`
    );
  }
}

const codePath = path.join(appsDir, 'Code.gs');

if (!fs.existsSync(codePath)) {
  errors.push(`Missing canonical Code.gs: ${codePath}`);
} else {
  const code = fs.readFileSync(codePath, 'utf8');
  const routes = [
    ...code.matchAll(/v2Action\s*===\s*['"]([^'"]+)['"]/g)
  ].map((match) => match[1]);

  const duplicates = [...new Set(
    routes.filter((route, index) => routes.indexOf(route) !== index)
  )];

  if (duplicates.length > 0) {
    errors.push(`Duplicate v2_action routes: ${duplicates.join(', ')}`);
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (
      Number.isFinite(manifest.route_count) &&
      routes.length !== manifest.route_count
    ) {
      errors.push(
        `Route count mismatch: Code.gs=${routes.length}, manifest=${manifest.route_count}`
      );
    }
  }

  console.log(`Routes: ${routes.length}`);
}

const possibleSecretPatterns = [
  /Bearer\s+[A-Za-z0-9._\-]{40,}/g,
  /CHANNEL_ACCESS_TOKEN\s*[:=]\s*['"][^'"]{20,}['"]/gi,
  /CLIENT_SECRET\s*[:=]\s*['"][^'"]{12,}['"]/gi
];

for (const file of [...gsFiles, ...htmlFiles]) {
  const source = fs.readFileSync(file, 'utf8');

  for (const pattern of possibleSecretPatterns) {
    if (pattern.test(source)) {
      errors.push(`Possible committed secret: ${path.relative(root, file)}`);
    }

    pattern.lastIndex = 0;
  }
}

console.log(`Apps Script files: ${gsFiles.length}`);
console.log(`HTML files: ${htmlFiles.length}`);

for (const warning of warnings) {
  console.warn(`WARNING: ${warning}`);
}

if (errors.length > 0) {
  console.error('\nValidation failed:\n');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log('CMWebs validation passed.');
