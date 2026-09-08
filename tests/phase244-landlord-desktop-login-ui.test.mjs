import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../landlord-entry.html', import.meta.url),
  'utf8'
);

const inlineScript = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('async function requestEmailLoginCode'));

assert.ok(inlineScript, 'landlord-entry.html must keep its inline entry script');

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createEntryRuntime() {
  const elements = new Map();
  const storage = new Map();
  const timers = new Set();
  const submittedLocations = [];

  function createElement(tagName, id = '') {
    const attributes = new Map();
    const element = {
      tagName: tagName.toUpperCase(),
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      hidden: false,
      style: {
        setProperty() {}
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
        if (name === 'disabled') this.disabled = true;
      },
      getAttribute(name) {
        return attributes.get(name) ?? null;
      },
      removeAttribute(name) {
        attributes.delete(name);
        if (name === 'disabled') this.disabled = false;
      }
    };
    if (id) elements.set(id, element);
    return element;
  }

  const app = createElement('div', 'app');
  const initialEmailInput = createElement('input', 'emailLoginInput');
  initialEmailInput.value = 'landlord@example.test';
  Object.defineProperty(app, 'innerHTML', {
    get() {
      return app._innerHTML || '';
    },
    set(value) {
      app._innerHTML = String(value);
      for (const id of [...elements.keys()]) {
        if (id !== 'app') elements.delete(id);
      }

      const elementPattern = /<(input|button|div)[^>]*\bid="([^"]+)"[^>]*>/gi;
      for (const match of app._innerHTML.matchAll(elementPattern)) {
        const element = createElement(match[1], match[2]);
        const tag = match[0];
        const value = tag.match(/\bvalue="([^"]*)"/i)?.[1];
        const text = tag.match(/\b(?:aria-label|aria-describedby|aria-live|role)="([^"]*)"/i);
        if (value) element.value = value;
        if (/\bdisabled(?:\s*=\s*"disabled")?/i.test(tag)) element.disabled = true;
        if (text) element.setAttribute(text[0].split('=')[0], text[1]);
      }
    }
  });

  const authCalls = {
    request: [],
    verify: []
  };
  const auth = {
    init() {
      return auth;
    },
    getMode() {
      return 'email';
    },
    getRequestAuthParams() {
      return {};
    },
    requestEmailCode(email) {
      authCalls.request.push(email);
      return auth.requestDeferred.promise;
    },
    verifyEmailCode(challengeId, code) {
      authCalls.verify.push({ challengeId, code });
      return auth.verifyDeferred.promise;
    }
  };

  const context = {
    URL,
    URLSearchParams,
    JSON,
    Math,
    Date,
    Error,
    String,
    Number,
    Promise,
    AbortController,
    document: {
      documentElement: createElement('html'),
      getElementById(id) {
        return elements.get(id) || null;
      }
    },
    location: {
      href: 'https://example.test/landlord-entry.html',
      origin: 'https://example.test',
      pathname: '/landlord-entry.html',
      search: '',
      hash: '',
      replace(value) {
        submittedLocations.push(value);
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
    setTimeout(callback) {
      const timer = { callback };
      timers.add(timer);
      return timer;
    },
    clearTimeout(timer) {
      timers.delete(timer);
    },
    CMWebsLandlordAuth: auth,
    console: {
      warn() {},
      error() {}
    }
  };
  context.window = context;
  context.window.CMWebsLandlordAuth = auth;
  context.authCalls = authCalls;
  context.submittedLocations = submittedLocations;
  auth.requestDeferred = createDeferred();
  auth.verifyDeferred = createDeferred();

  vm.createContext(context);
  vm.runInContext(
    inlineScript.replace(/\n\s*loadPage\(\);\s*$/, '\n'),
    context,
    { filename: 'landlord-entry.html:inline-script' }
  );

  return { context, elements, auth, authCalls };
}

function accessibleNamePattern(id) {
  return new RegExp(
    `(?:<label[^>]+for="${id}"[^>]*>[\\s\\S]*?<\\/label>|` +
      `id="${id}"[^>]*(?:aria-label|aria-labelledby|placeholder)="[^"]+"|` +
      `(?:aria-label|aria-labelledby|placeholder)="[^"]+"[^>]*id="${id}")`,
    'i'
  );
}

function extractFunctionSource(functionName) {
  const match = new RegExp(`async function ${functionName}\\(\\)\\s*\\{`).exec(source);
  assert.ok(match, `${functionName}() must exist in the page source`);

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

  throw new Error(`unterminated ${functionName}()`);
}

test('Phase 244 exposes the desktop landlord entry shell and stable auth controls', () => {
  assert.match(
    source,
    /<link[^>]+href="landlord-responsive\.css"/,
    'landlord-entry.html must load the shared responsive stylesheet'
  );
  assert.match(
    source,
    /<div class="app-shell desktop-ready">/,
    'landlord-entry.html must opt into the desktop-ready shell'
  );
  assert.match(
    source,
    /<main class="page desktop-main">/,
    'landlord-entry.html must expose the desktop-main page region'
  );
  assert.match(
    source,
    /<nav class="bottom-nav">/,
    'landlord-entry.html must keep the mobile bottom navigation'
  );

  assert.match(source, /id="emailLoginInput"/);
  assert.match(source, /id="emailLoginCodeInput"/);
  assert.match(source, accessibleNamePattern('emailLoginInput'));
  assert.match(source, accessibleNamePattern('emailLoginCodeInput'));
  assert.match(source, /id="emailLoginRequestButton"/);
  assert.match(source, /id="emailLoginVerifyButton"/);
  assert.match(source, /id="emailLoginMessage"/);
  assert.match(source, /id="lineLoginButton"/);
  assert.match(source, /(?:role="alert"|aria-live="(?:polite|assertive)")/);
});

test('Phase 244 keeps Email, OTP, challenge, session, and LINE identity values out of navigation URLs', () => {
  const buildPageUrl = source.match(
    /function buildPageUrl\(page\)\s*\{[\s\S]*?\n\s*\}/
  )?.[0];
  assert.ok(buildPageUrl, 'buildPageUrl() must remain the navigation URL boundary');
  assert.doesNotMatch(
    buildPageUrl,
    /(?:email|otp|challenge|session|line_user_id|lineUserId|LINE_USER_ID)/i
  );

  const returnToFunction = source.match(
    /function resolveReturnTo\(\)\s*\{[\s\S]*?\n\s*\}/
  )?.[0];
  assert.ok(returnToFunction, 'resolveReturnTo() must remain the safe return_to boundary');
  assert.match(returnToFunction, /return_to/);
  assert.match(source, /location\.replace\(\s*RETURN_TO\s*\)/);

  const navigationSinks = source.match(
    /(?:window\.)?location\.(?:href\s*=|assign\s*\(|replace\s*\()[\s\S]*?(?:;|\))/g
  ) || [];
  for (const sink of navigationSinks) {
    assert.doesNotMatch(
      sink,
      /(?:email|otp|challenge|session|line_user_id|lineUserId|LINE_USER_ID)/i,
      'location navigation sinks must not carry auth or identity values'
    );
  }

  const historyAndWindowSinks = source.match(
    /(?:window\.)?(?:open|history\.(?:pushState|replaceState))\s*\([\s\S]*?(?:;|\))/g
  ) || [];
  for (const sink of historyAndWindowSinks) {
    assert.doesNotMatch(
      sink,
      /(?:email|otp|challenge|session|line_user_id|lineUserId|LINE_USER_ID)/i,
      'preassembled window/history navigation sinks must not carry auth or identity values'
    );
  }

  assert.doesNotMatch(
    source,
    /(?:const|let|var)\s+\w*(?:url|href|redirect|target)\w*\s*=[^;]*(?:EMAIL_LOGIN_EMAIL|EMAIL_LOGIN_CHALLENGE_ID|LINE_USER_ID|landlord_session_token|line_user_id)/i,
    'preassembled sensitive navigation URLs must not be created before navigation'
  );
});

test('Phase 244 declares independent request and verify in-flight guards', () => {
  assert.match(source, /let EMAIL_LOGIN_REQUEST_IN_FLIGHT\s*=\s*false/);
  assert.match(source, /let EMAIL_LOGIN_VERIFY_IN_FLIGHT\s*=\s*false/);

  const requestFunction = extractFunctionSource('requestEmailLoginCode');
  const verifyFunction = extractFunctionSource('verifyEmailLoginCode');

  assert.match(requestFunction, /if\s*\(\s*EMAIL_LOGIN_REQUEST_IN_FLIGHT\s*\)\s*\{?\s*return/);
  assert.match(requestFunction, /EMAIL_LOGIN_REQUEST_IN_FLIGHT\s*=\s*true/);
  assert.match(requestFunction, /finally\s*\{[\s\S]*?EMAIL_LOGIN_REQUEST_IN_FLIGHT\s*=\s*false/);
  assert.match(verifyFunction, /if\s*\(\s*EMAIL_LOGIN_VERIFY_IN_FLIGHT\s*\)\s*\{?\s*return/);
  assert.match(verifyFunction, /EMAIL_LOGIN_VERIFY_IN_FLIGHT\s*=\s*true/);
  assert.match(verifyFunction, /finally\s*\{[\s\S]*?EMAIL_LOGIN_VERIFY_IN_FLIGHT\s*=\s*false/);
});

test('Phase 244 exposes immediate OTP busy, failure recovery, success, and cooldown states', () => {
  assert.match(source, /id="emailLoginRequestButton"[^>]*(?:disabled|aria-busy)/s);
  assert.match(source, /id="emailLoginVerifyButton"[^>]*(?:disabled|aria-busy)/s);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /寄送中…/);
  assert.match(source, /驗證中…/);
  assert.match(source, /驗證碼已寄出/);
  assert.match(source, /60 秒後可重新寄送/);
  assert.match(source, /EMAIL_LOGIN_COUNTDOWN_UNTIL\s*=\s*Date\.now\(\)\s*\+\s*60000/);
  assert.match(source, /finally\s*\{[\s\S]*?(?:disabled\s*=\s*false|removeAttribute\(['"]disabled['"]\))/);
});

test('Phase 244 executes request duplicate-click, busy, success, and cooldown behavior', async () => {
  const runtime = createEntryRuntime();
  const { context, elements, auth, authCalls } = runtime;

  const request = context.requestEmailLoginCode();
  await Promise.resolve();
  const requestButton = elements.get('emailLoginRequestButton');
  assert.equal(authCalls.request.length, 1);
  assert.ok(requestButton, 'request button must be rendered after submission');
  assert.equal(requestButton.disabled, true);
  assert.equal(requestButton.getAttribute('aria-busy'), 'true');
  assert.match(elements.get('emailLoginMessage')?.textContent || elements.get('app').innerHTML, /寄送中…/);

  const duplicate = context.requestEmailLoginCode();
  await Promise.resolve();
  assert.equal(authCalls.request.length, 1, 'a pending request must ignore rapid re-entry');

  auth.requestDeferred.resolve({ data: { challenge_id: `synthetic-${Date.now()}` } });
  await Promise.all([request, duplicate]);

  assert.match(elements.get('app').innerHTML, /驗證碼已寄出/);
  assert.equal(elements.get('emailResendButton')?.disabled, true);
  assert.match(elements.get('emailResendButton')?.textContent || elements.get('app').innerHTML, /60 秒後可重新寄送/);
});

test('Phase 244 executes verify duplicate-click, busy, and failure recovery behavior', async () => {
  const runtime = createEntryRuntime();
  const { context, elements, auth, authCalls } = runtime;

  const request = context.requestEmailLoginCode();
  auth.requestDeferred.resolve({ data: { challenge_id: `synthetic-${Date.now()}` } });
  await request;

  const codeInput = elements.get('emailLoginCodeInput');
  assert.ok(codeInput, 'OTP input must be rendered after a request succeeds');
  codeInput.value = String(100000 + (Date.now() % 900000));

  const verify = context.verifyEmailLoginCode();
  await Promise.resolve();
  const verifyButton = elements.get('emailLoginVerifyButton');
  assert.equal(authCalls.verify.length, 1);
  assert.ok(verifyButton, 'verify button must be rendered before verification');
  assert.equal(verifyButton.disabled, true);
  assert.equal(verifyButton.getAttribute('aria-busy'), 'true');
  assert.match(elements.get('app').innerHTML, /驗證中…/);

  const duplicate = context.verifyEmailLoginCode();
  await Promise.resolve();
  assert.equal(authCalls.verify.length, 1, 'a pending verification must ignore rapid re-entry');

  auth.verifyDeferred.reject(new Error('synthetic verification failure'));
  await Promise.all([verify, duplicate]);

  const recoveredVerifyButton = elements.get('emailLoginVerifyButton');
  assert.equal(recoveredVerifyButton?.disabled, false);
  assert.notEqual(recoveredVerifyButton?.getAttribute('aria-busy'), 'true');
  assert.match(elements.get('app').innerHTML, /(?:無效|過期|失敗|錯誤|再試)/);
});

test('Phase 244 gives OTP errors a live accessible region and names every form field', () => {
  assert.match(source, /id="emailLoginMessage"[^>]*(?:role="alert"|aria-live="(?:polite|assertive)")/s);
  assert.match(source, /emailLoginInput[\s\S]*?aria-describedby="emailLoginMessage"/);
  assert.match(source, /emailLoginCodeInput[\s\S]*?aria-describedby="emailLoginMessage"/);
});
