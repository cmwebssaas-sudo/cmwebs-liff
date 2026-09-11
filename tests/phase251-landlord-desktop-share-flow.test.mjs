import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('landlord-more.html', 'utf8');

assert.match(
  source,
  /<button[^>]+id="desktopEntryButton"[^>]+type="button"[^>]+onclick="openDesktopShareModal\(\)"/s,
  'the desktop entry must open a share modal instead of navigating immediately'
);

assert.match(
  source,
  /id="desktopShareModal"[^>]+role="dialog"[^>]+aria-modal="true"/s,
  'the desktop share flow must expose an accessible dialog'
);

assert.match(
  source,
  /id="desktopShareUrl"[^>]+readonly/,
  'the share modal must show a readonly desktop URL'
);

assert.match(
  source,
  /id="copyDesktopShareUrlButton"[^>]+onclick="copyDesktopShareUrl\(\)"/s,
  'the share modal must provide a copy action'
);

assert.match(
  source,
  /id="nativeDesktopShareButton"[^>]+onclick="shareDesktopUrl\(\)"/s,
  'the share modal must provide a native share action'
);

const inlineScript = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('function buildDesktopShareUrl'));
assert.ok(inlineScript, 'landlord-more.html must keep its inline share script');
const functionSource = inlineScript;
const shareFunctionStart = functionSource.indexOf('function buildDesktopShareUrl');
const shareFunctionEnd = functionSource.indexOf('function openDesktopShareModal');
assert.notEqual(shareFunctionStart, -1, 'the desktop share URL builder must exist');
assert.notEqual(shareFunctionEnd, -1, 'the desktop share modal opener must exist');
const shareFunctionSource = functionSource.slice(shareFunctionStart, shareFunctionEnd);
assert.match(
  shareFunctionSource,
  /searchParams\.set\(\s*['"]mode['"],\s*['"]email['"]\s*\)/,
  'the share URL must preserve Email login mode'
);
assert.match(
  shareFunctionSource,
  /searchParams\.set\(\s*['"]return_to['"],\s*['"]landlord-home\.html['"]\s*\)/,
  'the share URL must return to the landlord home page'
);

const app = { innerHTML: '' };
const modal = {
  hidden: true,
  setAttribute() {},
  removeAttribute() {},
  querySelector() { return null; }
};
const shareUrlInput = { value: '' };
const context = {
  URL,
  URLSearchParams,
  document: {
    documentElement: { style: { setProperty() {} } },
    body: { classList: { add() {}, remove() {} } },
    addEventListener() {},
    getElementById(id) {
      if (id === 'desktopShareModal') return modal;
      if (id === 'desktopShareUrl') return shareUrlInput;
      if (id === 'app') return app;
      return null;
    }
  },
  location: {
    href: 'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-more.html',
    origin: 'https://cmwebssaas-sudo.github.io',
    pathname: '/cmwebs-liff/landlord-more.html'
  },
  innerHeight: 900,
  addEventListener() {},
  setTimeout() { return 1; },
  clearTimeout() {},
  navigator: {},
  console: { warn() {}, error() {} }
};
context.window = context;

vm.createContext(context);
vm.runInContext(
  functionSource.replace(/\n\s*loadSummary\(\);\s*$/, '\n'),
  context,
  { filename: 'landlord-more.html:inline-script' }
);

const shareUrl = context.buildDesktopShareUrl();
assert.equal(
  shareUrl,
  'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-entry.html?mode=email&return_to=landlord-home.html',
  'the share URL must be stable and must not carry cache-busting or session data'
);

context.openDesktopShareModal();
assert.equal(modal.hidden, false, 'opening the desktop entry must reveal the share modal');
assert.equal(shareUrlInput.value, shareUrl, 'the modal must display the generated desktop URL');
context.closeDesktopShareModal();
assert.equal(modal.hidden, true, 'closing the desktop entry modal must hide it again');

console.log('Phase 251 landlord desktop share flow tests passed.');
