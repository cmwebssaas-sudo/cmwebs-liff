import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync('landlord-tenants.html', 'utf8');
const tenantBindSource = readFileSync('tenant-bind.html', 'utf8');

assert.match(
  source,
  /navigator\.share/,
  'the invitation must open the phone share sheet when available'
);
assert.match(
  source,
  /navigator\.clipboard\.writeText/,
  'desktop browsers need a copy fallback'
);
assert.doesNotMatch(
  tenantBindSource,
  /searchParams\.set\(\s*'v',\s*Date\.now\(\)/,
  'the binding target must reuse the fixed release version after login'
);
assert.match(
  source,
  /邀請綁定/,
  'the tenant list must expose a clear invitation label'
);
assert.match(
  source,
  /bindingStatus\s*===\s*'unbound'/,
  'only unbound tenants may receive a binding invitation action'
);

function extractFunction(functionName) {
  const match = new RegExp(
    `(?:async\\s+)?function\\s+${functionName}\\s*\\(`
  ).exec(source);

  assert.ok(match, `missing function ${functionName}`);

  const start = match.index;
  const bodyStart = source.indexOf('{', start);
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

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`unterminated function ${functionName}`);
}

function createInviteContext({ navigatorRef, testMode = false }) {
  const toasts = [];
  let legacyCopyAttempts = 0;
  const context = createContext({
    URL,
    location: {
      href: 'https://cmwebssaas-sudo.github.io/cmwebs-liff/landlord-tenants.html'
    },
    window: {
      CMWEBS_RELEASE_VERSION: '20260822-tenant-binding-invite-v1'
    },
    TEST_MODE: testMode,
    navigator: navigatorRef,
    rawText(value) {
      return value === undefined || value === null
        ? ''
        : String(value);
    },
    showToast(message) {
      toasts.push(message);
    },
    document: {
      createElement() {
        return {
          style: {},
          setAttribute() {},
          select() {},
          remove() {}
        };
      },
      body: {
        appendChild() {}
      },
      execCommand() {
        legacyCopyAttempts += 1;
        return true;
      }
    }
  });

  runInContext(
    [
      'tenantBindingInviteUrl',
      'buildTenantBindingInviteMessage',
      'copyTenantBindingInviteFallback',
      'copyTenantBindingInvite',
      'shouldUseTenantBindingNativeShare',
      'shareTenantBindingInvite'
    ].map(extractFunction).join('\n'),
    context
  );

  return {
    context,
    toasts,
    get legacyCopyAttempts() {
      return legacyCopyAttempts;
    }
  };
}

const shareCalls = [];
const phoneContext = createInviteContext({
  navigatorRef: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    async share(data) {
      shareCalls.push(data);
    }
  }
});
const inviteMessage = phoneContext.context.buildTenantBindingInviteMessage();

assert.match(
  inviteMessage,
  /tenant-bind\.html\?v=20260822-tenant-binding-invite-v1/,
  'invite opens the released tenant binding page'
);
assert.doesNotMatch(
  inviteMessage,
  /T000021|陳雅婷|09\d{8}/,
  'invite must not expose tenant identifiers or personal data'
);

let propagationStopped = false;
await phoneContext.context.shareTenantBindingInvite({
  stopPropagation() {
    propagationStopped = true;
  }
});

assert.equal(propagationStopped, true);
assert.equal(shareCalls.length, 1);
assert.equal(shareCalls[0].title, 'CMWebs 房客綁定');
assert.equal(shareCalls[0].text, inviteMessage);
assert.deepEqual(phoneContext.toasts, ['已開啟分享選單']);

const copiedMessages = [];
const desktopShareCalls = [];
const desktopContext = createInviteContext({
  navigatorRef: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
    async share(data) {
      desktopShareCalls.push(data);
    },
    clipboard: {
      async writeText(message) {
        copiedMessages.push(message);
      }
    }
  },
  testMode: true
});

await desktopContext.context.shareTenantBindingInvite();
assert.equal(copiedMessages.length, 1);
assert.equal(desktopShareCalls.length, 0);
assert.match(copiedMessages[0], /tenant-bind\.html\?v=20260822-tenant-binding-invite-v1&test=1/);
assert.deepEqual(
  desktopContext.toasts,
  ['綁定邀請已複製，可直接貼給房客']
);

const rejectedClipboardContext = createInviteContext({
  navigatorRef: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
    clipboard: {
      async writeText() {
        throw new Error('clipboard_denied');
      }
    }
  }
});

await rejectedClipboardContext.context.shareTenantBindingInvite();
assert.equal(
  rejectedClipboardContext.legacyCopyAttempts,
  1,
  'clipboard failures must use the legacy copy fallback before reporting an error'
);
assert.deepEqual(
  rejectedClipboardContext.toasts,
  ['綁定邀請已複製，可直接貼給房客']
);

console.log('Tenant binding invite share tests passed.');
