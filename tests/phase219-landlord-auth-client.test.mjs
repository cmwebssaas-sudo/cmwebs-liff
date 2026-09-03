import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const moduleUrl = new URL('../landlord-auth.js', import.meta.url);
const moduleExists = existsSync(moduleUrl);
const source = moduleExists ? readFileSync(moduleUrl, 'utf8') : '';
const guardedTest = moduleExists ? test : test.skip;
const dispatcherSource = readFileSync(new URL('../apps-script/程式碼.js', import.meta.url), 'utf8');

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
    dispatchMessage(data, origin = 'https://script.google.com') {
      for (const callback of listeners.get('message') || []) {
        callback({ data, origin, source: {} });
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
  });

  const result = await request;
  assert.equal(result.success, true);
  assert.equal(context.listenerCount('message'), 0);
  assert.equal(iframes[0].parentNode, null, 'bridge iframe must be removed after completion');
  assert.equal(form.parentNode, null, 'bridge form must be removed after completion');
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
  });

  await verified;
  assert.equal(storage.get('cmwebs_landlord_session_token'), 'SESSION_TOKEN_ABC');
  assert.deepEqual([...storage.keys()], ['cmwebs_landlord_session_token']);
  assert.equal(auth.getMode(), 'email');
  const authParams = auth.getRequestAuthParams();
  assert.equal(authParams.response_mode, 'bridge');
  assert.equal(authParams.landlord_session_token, 'SESSION_TOKEN_ABC');
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
  const fields = formFields(document.submittedForms[0]);
  context.dispatchMessage({
    source: 'CMWEBS_APPS_SCRIPT',
    requestId: fields.request_id,
    payload: {
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'session expired'
    }
  });

  await assert.rejects(status, /session expired/);
  assert.equal(storage.has('cmwebs_landlord_session_token'), false);
  assert.match(context.location.replacedWith, /^landlord-entry\.html/);
  assert.equal(context.location.replacedWith.includes('evil.test'), false);
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
