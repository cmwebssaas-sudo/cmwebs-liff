import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(
    new URL('../apps-script/appsscript.json', import.meta.url),
    'utf8'
  )
);

test(
  'Phase 242 declares the Apps Script send-mail scope for landlord Email verification',
  () => {
    assert.ok(
      manifest.oauthScopes.includes(
        'https://www.googleapis.com/auth/script.send_mail'
      ),
      'MailApp.sendEmail requires the explicit script.send_mail scope'
    );
  }
);
