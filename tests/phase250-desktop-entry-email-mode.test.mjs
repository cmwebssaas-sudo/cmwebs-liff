import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const moreSource = readFileSync('landlord-more.html', 'utf8');
const entrySource = readFileSync('landlord-entry.html', 'utf8');

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `${name}() must exist`);

  const bodyStart = source.indexOf('{', match.index);
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }

  throw new Error(`unterminated ${name}()`);
}

assert.match(
  moreSource,
  /<button[^>]+id="desktopEntryButton"[^>]+onclick="openDesktopShareModal\(\)"/s,
  'the desktop entry must open the share modal before the Email flow'
);
assert.match(
  moreSource,
  /id="desktopShareModal"[^>]+role="dialog"[^>]+aria-modal="true"/s,
  'the desktop share modal must be present'
);
assert.match(
  moreSource,
  /function buildDesktopShareUrl[\s\S]*searchParams\.set\([\s\S]*['"]mode['"][\s\S]*['"]email['"]/,
  'the shared desktop URL must explicitly request Email mode'
);

const loadPageSource = extractFunction(entrySource, 'loadPage');
assert.match(
  entrySource,
  /URL_PARAMS\.get\(['"]mode['"]\)\s*===\s*['"]email['"]|EMAIL_LOGIN_MODE/,
  'the entry page must recognize the explicit Email mode'
);
assert.match(
  loadPageSource,
  /EMAIL_LOGIN_MODE[\s\S]*auth\.getMode\(\)\s*===\s*['"]email['"]|auth\.getMode\(\)\s*===\s*['"]email['"][\s\S]*EMAIL_LOGIN_MODE/,
  'loadPage() must include explicit Email mode in the Email branch'
);
assert.match(
  loadPageSource,
  /renderEmailLogin\(\)/,
  'Email mode must render the Email login controls'
);
assert.ok(
  loadPageSource.indexOf('EMAIL_LOGIN_MODE') <
    loadPageSource.indexOf('await initLine()'),
  'explicit Email mode must be checked before LINE initialization'
);

const inlineScript = [...entrySource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('async function requestEmailLoginCode'));
assert.ok(inlineScript, 'landlord-entry.html must keep its inline entry script');

const app = { innerHTML: '' };
const storage = new Map();
const calls = [];
const auth = {
  init() {
    return auth;
  },
  getMode() {
    return 'line';
  },
  getRequestAuthParams() {
    return { line_user_id: '' };
  }
};

const context = {
  URL,
  URLSearchParams,
  Math,
  Date,
  String,
  Number,
  Boolean,
  Promise,
  Error,
  document: {
    documentElement: { style: { setProperty() {} } },
    getElementById(id) {
      return id === 'app' ? app : null;
    }
  },
  location: {
    href: 'https://example.test/landlord-entry.html?mode=email&return_to=landlord-home.html',
    origin: 'https://example.test',
    pathname: '/landlord-entry.html',
    search: '?mode=email&return_to=landlord-home.html',
    hash: '',
    replace(value) {
      calls.push(['replace', value]);
    }
  },
  sessionStorage: {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  },
  innerHeight: 900,
  visualViewport: {
    height: 900,
    addEventListener() {}
  },
  addEventListener() {},
  setTimeout() {
    return 1;
  },
  clearTimeout() {},
  CMWebsLandlordAuth: auth,
  liff: {
    init() {
      calls.push(['liff.init']);
      throw new Error('LINE must not initialize in explicit Email mode');
    }
  },
  console: {
    warn() {},
    error() {}
  }
};
context.window = context;
context.window.CMWebsLandlordAuth = auth;
storage.set('cmwebs_landlord_line_fallback_intent', '1');

vm.createContext(context);
vm.runInContext(
  inlineScript.replace(/\n\s*loadPage\(\);\s*$/, '\n'),
  context,
  { filename: 'landlord-entry.html:inline-script' }
);
await context.loadPage();
assert.match(app.innerHTML, /房東 Email 登入/);
assert.deepEqual(calls, [], 'explicit Email mode must not initialize the expired LINE session');

console.log('Phase 250 desktop entry Email mode regression test passed.');
