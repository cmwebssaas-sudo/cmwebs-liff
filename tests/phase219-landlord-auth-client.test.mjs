import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const moduleUrl = new URL('../landlord-auth.js', import.meta.url);
const moduleExists = existsSync(moduleUrl);
const source = moduleExists ? readFileSync(moduleUrl, 'utf8') : '';
const guardedTest = moduleExists ? test : test.skip;
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../landlord-entry.html', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../landlord-settings.html', import.meta.url), 'utf8');

function extractFunctionSource(source, functionName) {
  const match = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(source);
  assert.ok(match, `${functionName} must exist in the page source`);

  const bodyStart = source.indexOf('{', match.index);
  assert.notEqual(bodyStart, -1, `${functionName} must include a body`);

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

  throw new Error(`unterminated ${functionName}`);
}

const settingsJsonpRequestSource = extractFunctionSource(settingsSource, 'jsonpRequest');

function createElement(tagName, ownerDocument) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    attributes: {},
    style: {},
    parentNode: null,
    ownerDocument,
    textContent: '',
    value: '',
    name: '',
    type: '',
    method: '',
    action: '',
    target: '',
    src: '',
    id: '',
    className: '',
    disabled: false,
    hidden: false,
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      this[name] = String(value);
    },
    submit() {
      ownerDocument.submittedForms.push(this);
    }
  };
  if (element.tagName === 'IFRAME') {
    element.contentWindow = {};
  }
  return element;
}

function walk(element, callback) {
  callback(element);
  for (const child of element.children || []) walk(child, callback);
}

function formFields(form) {
  const fields = {};
  walk(form, (element) => {
    if (element.name) fields[element.name] = element.value;
  });
  return fields;
}

function createRuntime(width = 1440) {
  const listeners = new Map();
  const storage = new Map();
  const document = {
    submittedForms: [],
    created: [],
    body: null,
    createElement(tagName) {
      const element = createElement(tagName, document);
      document.created.push(element);
      return element;
    },
    getElementById() {
      return null;
    }
  };
  document.body = createElement('body', document);

  const context = {
    URL,
    URLSearchParams,
    JSON,
    String,
    Number,
    Boolean,
    Math,
    Date,
    Error,
    Promise,
    clearTimeout,
    setTimeout,
    document,
    location: {
      href: 'https://example.test/landlord-entry.html?return_to=landlord-home.html',
      origin: 'https://example.test',
      pathname: '/landlord-entry.html',
      search: '?return_to=landlord-home.html',
      hash: '',
      replace(value) {
        context.location.replacedWith = value;
      }
    },
    sessionStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
      key(index) {
        return [...storage.keys()][index] || null;
      },
      get length() {
        return storage.size;
      }
    },
    innerWidth: width,
    matchMedia(query) {
      return {
        matches: query.includes('1024px') ? width >= 1024 : false,
        media: query,
        addEventListener() {},
        removeEventListener() {}
      };
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      if (listeners.has(type)) listeners.get(type).delete(callback);
    },
    dispatchMessage(data, origin = 'https://script.google.com', sourceWindow = {}) {
      for (const callback of listeners.get('message') || []) {
        callback({ data, origin, source: sourceWindow });
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
    console: {
      warn() {},
      error() {}
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'landlord-auth.js' });
  return { context, document, storage };
}

test('Phase 219 requires the shared landlord auth client module', () => {
  assert.equal(
    moduleExists,
    true,
    'landlord-auth.js must exist before the client auth contract can be released'
  );
});

guardedTest('Phase 219 sends Email OTP requests through a hidden POST iframe without GET leakage', async () => {
  const { context, document } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;

  assert.equal(typeof auth.init, 'function');
  assert.equal(typeof auth.getMode, 'function');
  assert.equal(typeof auth.getRequestAuthParams, 'function');
  assert.equal(typeof auth.requestEmailCode, 'function');
  assert.equal(typeof auth.verifyEmailCode, 'function');
  assert.equal(typeof auth.requestEmailVerification, 'function');
  assert.equal(typeof auth.verifyEmailVerification, 'function');
  assert.equal(typeof auth.getSessionStatus, 'function');
  assert.equal(typeof auth.logout, 'function');

  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    liffId: 'line-liff-id',
    lineUserId: 'line-1'
  });

  const request = auth.requestEmailCode('owner@example.com');
  assert.equal(document.submittedForms.length, 1);
  const form = document.submittedForms[0];
  assert.equal(form.method.toUpperCase(), 'POST');
  assert.equal(form.target.startsWith('cmwebs_landlord_auth_'), true);
  assert.equal(form.action, 'https://script.google.com/macros/s/example/exec');
  assert.equal(form.action.includes('owner@example.com'), false);
  assert.equal(form.action.includes('123456'), false);
  assert.equal(form.action.includes('SESSION_TOKEN'), false);

  const iframes = document.created.filter((element) => element.tagName === 'IFRAME');
  assert.equal(iframes.length, 1);
  assert.equal(iframes[0].hidden || iframes[0].style.display === 'none', true);

  const fields = formFields(form);
  assert.equal(fields.action, 'landlord_email_login_request');
  assert.equal(fields.response_mode, 'bridge');
  assert.equal(fields.email, 'owner@example.com');
  assert.match(fields.request_id, /^cmwebs_auth_/);
  assert.equal(context.listenerCount('message'), 1);

  context.dispatchMessage({
    source: 'UNRELATED_SOURCE',
    requestId: fields.request_id,
    payload: { success: true }
  });
  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: 'wrong-request',
    payload: { success: true }
  });

  assert.equal(context.listenerCount('message'), 1);

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: true,
      data: {
        challenge_id: 'challenge-1'
      }
    }
  }, 'https://script.google.com', iframes[0].contentWindow);

  const result = await request;
  assert.equal(result.success, true);
  assert.equal(context.listenerCount('message'), 0);
  assert.equal(iframes[0].parentNode, null, 'bridge iframe must be removed after completion');
  assert.equal(form.parentNode, null, 'bridge form must be removed after completion');
});

guardedTest('Phase 219 ignores bridge messages from the wrong window or origin', async () => {
  const { context, document } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec'
  });

  const request = auth.requestEmailCode('owner@example.com');
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  const fields = formFields(document.submittedForms[0]);

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: { success: true }
  }, 'https://script.google.com', {});

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: { success: true }
  }, 'https://evil.test', iframe.contentWindow);

  assert.equal(context.listenerCount('message'), 1);

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: true,
      data: {
        challenge_id: 'challenge-2'
      }
    }
  }, 'https://script.google.com', iframe.contentWindow);

  const result = await request;
  assert.equal(result.success, true);
  assert.equal(context.listenerCount('message'), 0);
});

guardedTest('Phase 219 dispatcher accepts bridge fields from hidden iframe POST forms', () => {
  assert.match(
    dispatcherSource,
    /request\s*=\s*Object\.assign\(\s*\{\}\s*,\s*e\.parameter\s*\|\|\s*\{\}\s*\)/,
    'doPost must accept hidden iframe POST form fields when the body is not JSON'
  );
  assert.doesNotMatch(
    dispatcherSource,
    /e\.parameter\.(?:code|session_token|landlord_session_token)/,
    'bridge form fallback must copy POST parameters as a request object, not read OTP/session secrets from GET-specific fields'
  );
});

guardedTest('Phase 219 stores only the opaque landlord Email session token after code verification', async () => {
  const { context, document, storage } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec'
  });

  const verified = auth.verifyEmailCode('challenge-1', '123456');
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  const fields = formFields(document.submittedForms[0]);
  assert.equal(fields.action, 'landlord_email_login_verify');
  assert.equal(fields.challenge_id, 'challenge-1');
  assert.equal(fields.code, '123456');
  assert.equal(document.submittedForms[0].action.includes('123456'), false);
  assert.equal(document.submittedForms[0].action.includes('challenge-1'), false);

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: true,
      data: {
        session_token: 'SESSION_TOKEN_ABC',
        session_expires_at: '2026-09-04T13:02:03.000Z',
        user_id: 'user-1',
        workspace_id: 'WS-1',
        role: 'owner'
      }
    }
  }, 'https://script.google.com', iframe.contentWindow);

  await verified;
  assert.equal(storage.get('cmwebs_landlord_session_token'), 'SESSION_TOKEN_ABC');
  assert.deepEqual([...storage.keys()], ['cmwebs_landlord_session_token']);
  assert.equal(auth.getMode(), 'email');
  const authParams = auth.getRequestAuthParams();
  assert.equal(authParams.response_mode, 'bridge');
  assert.equal(authParams.landlord_session_token, 'SESSION_TOKEN_ABC');
});

guardedTest('Phase 219 sends authenticated Email-session page actions through POST bridge only', async () => {
  const { context, document, storage } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    returnTo: 'landlord-home.html'
  });
  storage.set('cmwebs_landlord_session_token', 'SESSION_TOKEN_ABC');

  assert.equal(typeof auth.request, 'function');

  const request = auth.request('landlord_home_bootstrap', {
    filter: 'current'
  });
  assert.equal(document.submittedForms.length, 1);
  const form = document.submittedForms[0];
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  assert.equal(form.method.toUpperCase(), 'POST');
  assert.equal(form.action, 'https://script.google.com/macros/s/example/exec');
  assert.equal(form.action.includes('SESSION_TOKEN_ABC'), false);
  assert.equal(form.action.includes('landlord_home_bootstrap'), false);

  const fields = formFields(form);
  assert.equal(fields.action, 'landlord_home_bootstrap');
  assert.equal(fields.v2_action, 'landlord_home_bootstrap');
  assert.equal(fields.response_mode, 'bridge');
  assert.equal(fields.landlord_session_token, 'SESSION_TOKEN_ABC');
  assert.equal(fields.line_user_id, undefined);
  assert.equal(fields.filter, 'current');

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: true,
      data: {
        ok: true
      }
    }
  }, 'https://script.google.com', iframe.contentWindow);

  const result = await request;
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { ok: true });
});

guardedTest('Phase 219 sends the settings page bootstrap through the authenticated POST bridge', async () => {
  const { context, document, storage } = createRuntime();
  context.API_URL = 'https://script.google.com/macros/s/example/exec';
  context.LINE_USER_ID = 'line-1';
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    returnTo: 'landlord-settings.html'
  });
  storage.set('cmwebs_landlord_session_token', 'SESSION_TOKEN_SETTINGS');

  const settingsJsonpRequest = vm.runInContext(
    `(${settingsJsonpRequestSource})`,
    context,
    { filename: 'landlord-settings.html:jsonpRequest' }
  );
  const request = settingsJsonpRequest('landlord_settings_init', {});
  const form = document.submittedForms[0];
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  const fields = formFields(form);

  assert.equal(form.method.toUpperCase(), 'POST');
  assert.equal(form.action, 'https://script.google.com/macros/s/example/exec');
  assert.equal(form.action.includes('SESSION_TOKEN_SETTINGS'), false);
  assert.equal(fields.action, 'landlord_settings_init');
  assert.equal(fields.v2_action, 'landlord_settings_init');
  assert.equal(fields.response_mode, 'bridge');
  assert.equal(fields.landlord_session_token, 'SESSION_TOKEN_SETTINGS');
  assert.equal(fields.line_user_id, undefined);

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: true,
      data: {
        profile: {
          display_name: 'Owner'
        }
      }
    }
  }, 'https://script.google.com', iframe.contentWindow);

  const result = await request;
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    profile: {
      display_name: 'Owner'
    }
  });
});

guardedTest('Phase 219 test mode keeps Email actions free of deterministic test LINE identity', async () => {
  const { context, document } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    lineUserId: 'TEST_LINE_USER_ID_SHOULD_NOT_LEAK',
    testMode: true
  });

  const request = auth.requestEmailVerification('owner@example.com');
  const form = document.submittedForms[0];
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  const fields = formFields(form);
  assert.equal(fields.action, 'landlord_email_verify_request');
  assert.equal(fields.email, 'owner@example.com');
  assert.equal(fields.line_user_id, undefined);
  assert.equal(JSON.stringify(fields).includes('TEST_LINE_USER_ID_SHOULD_NOT_LEAK'), false);

  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: true,
      data: {
        challenge_id: 'challenge-verify-1'
      }
    }
  }, 'https://script.google.com', iframe.contentWindow);

  await request;
});

guardedTest('Phase 219 clears Email session and redirects through a validated return_to on auth failures', async () => {
  const { context, document, storage } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    returnTo: 'https://evil.test/steal'
  });
  storage.set('cmwebs_landlord_session_token', 'SESSION_TOKEN_ABC');

  const status = auth.getSessionStatus();
  const iframe = document.created.find((element) => element.tagName === 'IFRAME');
  const fields = formFields(document.submittedForms[0]);
  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'session expired'
    }
  }, 'https://script.google.com', iframe.contentWindow);

  await assert.rejects(status, /session expired/);
  assert.equal(storage.has('cmwebs_landlord_session_token'), false);
  assert.match(context.location.replacedWith, /^landlord-entry\.html/);
  assert.equal(context.location.replacedWith.includes('evil.test'), false);
});

guardedTest('Phase 219 exposes uniform auth failure handling without retrying or switching identity', () => {
  const { context, storage } = createRuntime();
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    returnTo: 'landlord-properties.html?test=1'
  });
  storage.set('cmwebs_landlord_session_token', 'SESSION_TOKEN_ABC');

  assert.equal(typeof auth.handleAuthFailure, 'function');
  const handled = auth.handleAuthFailure({
    success: false,
    code: 'WORKSPACE_FORBIDDEN',
    message: 'workspace forbidden'
  });

  assert.equal(handled, true);
  assert.equal(storage.has('cmwebs_landlord_session_token'), false);
  assert.match(context.location.replacedWith, /^landlord-entry\.html/);
  assert.match(context.location.replacedWith, /return_to=landlord-properties\.html%3Ftest%3D1/);
});

guardedTest('Phase 219 keeps mobile in LINE mode unless an Email session exists', () => {
  const { context } = createRuntime(390);
  const auth = context.window.CMWebsLandlordAuth;
  auth.init({
    apiUrl: 'https://script.google.com/macros/s/example/exec',
    lineUserId: 'line-1'
  });

  assert.equal(auth.getMode(), 'line');
  assert.equal(auth.getRequestAuthParams().line_user_id, 'line-1');
});

guardedTest('Phase 219 preserves desktop LINE fallback intent across LIFF reloads', () => {
  assert.match(
    entrySource,
    /cmwebs_landlord_line_fallback_intent/,
    'entry page must persist explicit LINE fallback intent before LIFF redirects'
  );
  assert.match(
    entrySource,
    /hasLineFallbackIntent\(\)[\s\S]*?initLine\(\)/,
    'entry page must check fallback intent before the desktop Email-first branch and run the LINE path'
  );
  assert.match(
    entrySource,
    /clearLineFallbackIntent\(\)[\s\S]*?goPage\(\s*'landlord-home\.html'\s*\)/,
    'entry page must clear fallback intent after the LINE status path succeeds'
  );
});

guardedTest('Phase 219 settings verifies only the persisted bound Email', () => {
  assert.match(
    settingsSource,
    /function\s+persistedProfileEmail\(\)/,
    'settings page must derive the bound Email from loaded server data'
  );
  assert.match(
    settingsSource,
    /inputValue\(\s*'profileEmail'\s*\)[\s\S]*?persistedProfileEmail\(\)/,
    'settings verification must compare the edited Email input to the persisted Email before requesting a code'
  );
  assert.match(
    settingsSource,
    /先儲存 Email/,
    'settings page must block unsaved Email verification with a clear save-first state'
  );
});
