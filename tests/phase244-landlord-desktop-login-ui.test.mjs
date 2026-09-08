import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../landlord-entry.html', import.meta.url),
  'utf8'
);

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

  assert.match(source, /<label[^>]+for="emailLoginInput"[^>]*>Email<\/label>/);
  assert.match(source, /id="emailLoginInput"/);
  assert.match(source, /<label[^>]+for="emailLoginCodeInput"[^>]*>驗證碼<\/label>/);
  assert.match(source, /id="emailLoginCodeInput"/);
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

  const navigationCalls = source.match(
    /(?:location\.(?:replace|assign)|window\.location\.(?:replace|assign))\s*\([\s\S]*?\)/g
  ) || [];
  for (const call of navigationCalls) {
    assert.doesNotMatch(
      call,
      /(?:email|otp|challenge|session|line_user_id|lineUserId|LINE_USER_ID)/i,
      'navigation calls must not carry auth or identity values'
    );
  }
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

test('Phase 244 gives OTP errors a live accessible region and names every form field', () => {
  assert.match(source, /id="emailLoginMessage"[^>]*(?:role="alert"|aria-live="(?:polite|assertive)")/s);
  assert.match(source, /emailLoginInput[\s\S]*?aria-describedby="emailLoginMessage"/);
  assert.match(source, /emailLoginCodeInput[\s\S]*?aria-describedby="emailLoginMessage"/);
});
