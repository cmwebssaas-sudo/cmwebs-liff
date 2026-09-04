import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  new URL('../apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js', import.meta.url),
  'utf8'
);

const DOCUMENT_HEADERS = [
  'document_id', 'workspace_id', 'landlord_id', 'tenant_id', 'contract_id',
  'document_type', 'file_name', 'mime_type', 'byte_size', 'created_at', 'status', 'note'
];
const CONTRACT_HEADERS = [
  'contract_id', 'workspace_id', 'landlord_id', 'tenant_id', 'previous_contract_id',
  'renewed_from_contract_id', 'renewed_to_contract_id', 'created_at',
  'legacy_signed_at', 'legacy_signed_document_url', 'legacy_signed_pdf_url',
  'legacy_identity_front_url', 'legacy_identity_back_url'
];

class FakeSheet {
  constructor(headers, rows) {
    this.headers = headers.slice();
    this.rows = rows.map(row => row.slice());
  }

  getLastColumn() {
    return this.headers.length;
  }

  getRange(row, column, numRows = 1, numColumns = this.headers.length) {
    return {
      getDisplayValues: () => row === 1
        ? [this.headers.slice(column - 1, column - 1 + numColumns)]
        : this.rows.slice(row - 2, row - 2 + numRows).map(item => item.slice(column - 1, column - 1 + numColumns)),
      setValue: value => {
        if (row === 1) this.headers[column - 1] = value;
      },
      setValues: values => {
        if (row === 1) this.headers = values[0].slice();
      }
    };
  }
}

function rowFor(headers, values) {
  return headers.map(header => values[header] === undefined ? '' : values[header]);
}

function objects(sheet) {
  return sheet.rows.map(row => {
    const object = {};
    sheet.headers.forEach((header, index) => { object[header] = row[index] ?? ''; });
    return object;
  });
}

const contractSheet = new FakeSheet(CONTRACT_HEADERS, [
  rowFor(CONTRACT_HEADERS, {
    contract_id: 'PAPER-202', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T202', previous_contract_id: 'ORPHAN-202'
  }),
  rowFor(CONTRACT_HEADERS, {
    contract_id: 'ORPHAN-202', workspace_id: 'W1', landlord_id: 'L1',
    created_at: '2026-08-01T00:00:00Z', legacy_signed_at: '2026-08-01T00:00:00Z',
    legacy_signed_document_url: 'https://legacy.example/202-contract.docx',
    legacy_signed_pdf_url: 'https://legacy.example/202-contract.pdf',
    legacy_identity_front_url: 'https://legacy.example/202-id-front.jpg',
    legacy_identity_back_url: 'https://legacy.example/202-id-back.jpg'
  }),
  rowFor(CONTRACT_HEADERS, {
    contract_id: 'OTHER', workspace_id: 'W1', landlord_id: 'L1'
  })
]);
const documentSheet = new FakeSheet(DOCUMENT_HEADERS, [
  rowFor(DOCUMENT_HEADERS, {
    document_id: 'D-PAPER', workspace_id: 'W1', landlord_id: 'L1', tenant_id: 'T202',
    contract_id: 'PAPER-202', document_type: 'legacy_contract', file_name: 'paper.pdf',
    mime_type: 'application/pdf', byte_size: 100, created_at: '2026-09-05T00:00:00Z', status: 'stored'
  }),
  rowFor(DOCUMENT_HEADERS, {
    document_id: 'D-ORPHAN', workspace_id: 'W1', landlord_id: 'L1', tenant_id: '',
    contract_id: 'ORPHAN-202', document_type: 'identity_front', file_name: 'id-front.jpg',
    mime_type: 'image/jpeg', byte_size: 100, created_at: '2026-09-04T00:00:00Z', status: 'stored'
  }),
  rowFor(DOCUMENT_HEADERS, {
    document_id: 'D-OTHER', workspace_id: 'W1', landlord_id: 'L1', tenant_id: '',
    contract_id: 'OTHER', document_type: 'identity_back', file_name: 'other.jpg',
    mime_type: 'image/jpeg', byte_size: 100, created_at: '2026-09-03T00:00:00Z', status: 'stored'
  })
]);

const context = {
  Date,
  Number,
  String,
  isNaN,
  runtimeSpreadsheet_: () => ({ getSheetByName: name => name === 'V2_contracts' ? contractSheet : documentSheet }),
  lmSheetObjects_: sheet => objects(sheet)
};

vm.runInNewContext(source, context, { filename: 'V2_LANDLORD_CONTRACT_DOCUMENTS.js' });

const documents = context.ldGetContractDocuments_(
  { landlord_id: 'L1', workspace_id: 'W1' },
  '',
  'T202'
);

assert.deepEqual(
  documents.map(document => document.document_id).sort(),
  ['D-ORPHAN', 'D-PAPER'],
  'tenant detail must include documents linked to the tenant current contract lineage'
);
assert.equal(
  documents.some(document => document.document_id === 'D-OTHER'),
  false,
  'tenant document lineage must not include another contract'
);

const legacyDocuments = context.ldGetLegacyContractDocuments_(
  { landlord_id: 'L1', workspace_id: 'W1' },
  '',
  'T202'
);

assert.deepEqual(
  Array.from(legacyDocuments, document => document.document_type).sort(),
  ['identity_back', 'identity_front', 'legacy_contract'],
  'tenant detail must expose legacy contract and identity URLs from the same contract lineage'
);
assert.equal(
  legacyDocuments.every(document => /^https:\/\//.test(document.external_url)),
  true,
  'legacy document links must be HTTPS-only'
);

console.log('Phase 224 tenant document lineage runtime tests passed.');
