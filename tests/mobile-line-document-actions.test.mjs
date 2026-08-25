import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const helperUrl = new URL('../document-mobile-actions.js', import.meta.url);
const releaseScript = readFileSync(
  new URL('../frontend-release.js', import.meta.url),
  'utf8'
);

assert.match(
  releaseScript,
  /CMWEBS_RELEASE_VERSION\s*=\s*'20260825-tenant-signature-preview-v1'/,
  'the release URL must change so LINE does not reuse the broken page'
);

assert.equal(
  existsSync(helperUrl),
  true,
  'LINE mobile document actions must have a shared browser helper'
);

const require = createRequire(import.meta.url);
const actions = require(fileURLToPath(helperUrl));

const shareCalls = [];
const navigatorRef = {
  userAgent: 'Mozilla/5.0 iPhone Line/16.8.0',
  canShare(data) {
    return Array.isArray(data.files) && data.files.length === 1;
  },
  async share(data) {
    shareCalls.push(data);
  }
};

class TestFile {
  constructor(parts, name, options) {
    this.parts = parts;
    this.name = name;
    this.type = options.type;
  }
}

assert.equal(
  actions.shouldUseSystemFileMenu({ navigatorRef }),
  true,
  'LINE in-app browser must use the working system file menu'
);
assert.equal(
  actions.shouldUseSystemFileMenu({
    navigatorRef: {
      userAgent: 'Mozilla/5.0 Macintosh Safari/605.1.15',
      share() {}
    }
  }),
  false,
  'desktop browsers must keep their direct download and print behavior'
);
assert.equal(
  actions.shouldUseSystemFileMenu({
    navigatorRef: { userAgent: 'Mozilla/5.0', share() {} },
    liffRef: { isInClient: () => true }
  }),
  true,
  'LIFF client detection must work even when LINE is absent from the user agent'
);

const blob = { type: 'application/pdf' };
await actions.openSystemFileMenu({
  blob,
  fileName: 'old-contract.pdf',
  navigatorRef,
  FileCtor: TestFile
});

assert.equal(shareCalls.length, 1);
assert.equal(shareCalls[0].files[0].name, 'old-contract.pdf');
assert.equal(shareCalls[0].files[0].type, 'application/pdf');
assert.equal(shareCalls[0].files[0].parts[0], blob);

const pageSources = Object.fromEntries(
  [
    'landlord-tenant-detail.html',
    'landlord-contract-documents.html'
  ].map((pageName) => [
    pageName,
    readFileSync(new URL(`../${pageName}`, import.meta.url), 'utf8')
  ])
);

for (const page of Object.values(pageSources)) {

  assert.match(page, /document-mobile-actions\.js\?v=20260822-line-actions-v1/);
  assert.match(page, /shouldUseSystemFileMenu/);
  assert.match(page, /openSystemFileMenu/);
  assert.match(page, /preventDefault\(\)/);
  assert.match(page, /儲存到檔案/);
  assert.match(page, /手機選單.*列印/);
}

assert.match(
  pageSources['landlord-tenant-detail.html'],
  /href="landlord-contract-documents\.html\?v=20260822-line-actions-v1"/,
  'tenant detail must open the released document overview instead of a cached copy'
);
assert.match(
  pageSources['landlord-contract-documents.html'],
  /landlord-tenant-detail\.html\?tenant_id=[\s\S]*?&v=20260822-line-actions-v1/,
  'document overview must open the released tenant detail instead of a cached copy'
);

function extractFunction(source, functionName) {
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

function createButton() {
  return {
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
  };
}

async function assertPageRoutesMobileActions(config) {
  const buttons = {
    [config.downloadSelector]: createButton(),
    [config.printSelector]: createButton(),
    [config.shareSelector]: createButton()
  };
  const closeButton = createButton();
  const modal = {
    id: '',
    className: '',
    innerHTML: '',
    setAttribute() {},
    querySelector(selector) {
      return buttons[selector] || null;
    },
    querySelectorAll() {
      return [closeButton];
    }
  };
  const systemMenuCalls = [];
  const context = createContext({
    window: {
      CMWebsDocumentMobileActions: {
        shouldUseSystemFileMenu: () => true,
        async openSystemFileMenu(options) {
          systemMenuCalls.push(options);
        }
      }
    },
    document: {
      createElement: () => modal,
      body: {
        appendChild() {},
        classList: { add() {} }
      }
    },
    showToast() {},
    safeHtml: (value) => String(value),
    safeText: (value) => String(value),
    rawText: (value) => String(value),
    setTimeout() {},
    [config.closeFunction]: () => {},
    [config.shareFunction]: () => {}
  });
  const declarations = [
    config.shouldUseFunction,
    config.openSystemMenuFunction,
    config.printFunction,
    config.openModalFunction
  ].map((name) => extractFunction(config.source, name));

  runInContext(
    `var ${config.objectUrlVariable} = '';` +
      `var ${config.blobVariable} = null;` +
      `var ${config.fileNameVariable} = '';` +
      declarations.join('\n'),
    context
  );

  const documentBlob = { type: 'application/pdf' };
  context[config.openModalFunction](
    { file_name: 'old-contract.pdf', mime_type: 'application/pdf' },
    'blob:contract',
    documentBlob
  );

  let prevented = false;
  buttons[config.downloadSelector].listeners.click({
    preventDefault() {
      prevented = true;
    }
  });
  await Promise.resolve();

  assert.equal(prevented, true, `${config.pageName} download must prevent blob navigation in LINE`);
  assert.equal(systemMenuCalls.length, 1, `${config.pageName} download must open the system file menu`);
  assert.equal(systemMenuCalls[0].blob, documentBlob);

  await buttons[config.printSelector].listeners.click();
  assert.equal(systemMenuCalls.length, 2, `${config.pageName} print must open the system file menu`);
  assert.equal(systemMenuCalls[1].blob, documentBlob);
}

await assertPageRoutesMobileActions({
  pageName: 'landlord-tenant-detail.html',
  source: pageSources['landlord-tenant-detail.html'],
  shouldUseFunction: 'shouldUseTenantDocumentSystemMenu',
  openSystemMenuFunction: 'openTenantDocumentSystemMenu',
  printFunction: 'printTenantDocumentPreview',
  openModalFunction: 'openTenantDocumentActionModal',
  closeFunction: 'closeTenantDocumentActionModal',
  shareFunction: 'shareTenantDocumentPreview',
  objectUrlVariable: 'CURRENT_TENANT_DOCUMENT_OBJECT_URL',
  blobVariable: 'CURRENT_TENANT_DOCUMENT_BLOB',
  fileNameVariable: 'CURRENT_TENANT_DOCUMENT_FILE_NAME',
  downloadSelector: '#tenantDocumentPreviewDownload',
  printSelector: '[data-tenant-document-print]',
  shareSelector: '[data-tenant-document-share]'
});

await assertPageRoutesMobileActions({
  pageName: 'landlord-contract-documents.html',
  source: pageSources['landlord-contract-documents.html'],
  shouldUseFunction: 'shouldUseDocumentSystemMenu',
  openSystemMenuFunction: 'openDocumentSystemMenu',
  printFunction: 'printDocumentPreview',
  openModalFunction: 'openDocumentActionModal',
  closeFunction: 'closeDocumentActionModal',
  shareFunction: 'shareDocumentPreview',
  objectUrlVariable: 'CURRENT_DOCUMENT_OBJECT_URL',
  blobVariable: 'CURRENT_DOCUMENT_BLOB',
  fileNameVariable: 'CURRENT_DOCUMENT_FILE_NAME',
  downloadSelector: '#documentPreviewDownload',
  printSelector: '[data-document-print]',
  shareSelector: '[data-document-share]'
});

console.log('LINE mobile document action tests passed.');
