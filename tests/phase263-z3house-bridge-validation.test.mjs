import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
  'apps-script/V3_Z3HOUSE_LISTING_BRIDGE.js',
  'utf8'
);
const context = {
  console,
  Date,
  Number,
  String,
  Math,
  Array,
  Object,
  JSON,
  isFinite,
  isNaN,
  Utilities: {}
};

vm.createContext(context);
vm.runInContext(
  source + '\nthis.validate = z3houseListingBridgeValidatePayload_;',
  context
);

function payload(overrides = {}) {
  const now = new Date().toISOString();
  return {
    action: 'z3house_listing_event',
    timestamp: Math.floor(Date.now() / 1000),
    nonce: 'nonce-1',
    event_id: 'event-1',
    event_type: 'listing.snapshot',
    occurred_at: now,
    binding: {
      workspace_id: 'WS-1',
      room_id: 'R-1'
    },
    source: {
      organization_id: 'ORG-1',
      site_id: 'SITE-1',
      listing_id: 'LIST-1',
      revision: 'published:1',
      updated_at: now
    },
    listing: {
      title: 'Room 1',
      summary: 'Summary',
      description: 'Description',
      monthly_price: 19000,
      management_fee: '1000',
      electricity_fee: '依台電',
      availability: 'available',
      published: true,
      thumbnail_url: 'https://dalino88.z3house.com/api/public/media/1',
      independent_site_url: 'https://dalino88.z3house.com/room/1',
      photos: [{
        photo_url: 'https://dalino88.z3house.com/api/public/media/1',
        sort_order: 0,
        alt: 'Room'
      }]
    },
    ...overrides
  };
}

const valid = context.validate(payload());
assert.equal(valid.success, true);
assert.equal(valid.data.listing.photos.length, 1);

const forbidden = context.validate(payload({
  event_id: 'event-2',
  listing: {
    ...payload().listing,
    metadata: { tenantName: 'blocked' }
  }
}));
assert.equal(forbidden.code, 'FORBIDDEN_DATA');

const unknown = context.validate(payload({
  event_id: 'event-3',
  source: {
    ...payload().source,
    unexpected: true
  }
}));
assert.equal(unknown.code, 'UNSUPPORTED_FIELD');

const hidden = context.validate(payload({
  event_id: 'event-4',
  event_type: 'publication.hidden',
  listing: undefined
}));
assert.equal(hidden.success, true);
assert.equal(hidden.data.listing, null);

const unsafeUrl = context.validate(payload({
  event_id: 'event-5',
  listing: {
    ...payload().listing,
    thumbnail_url: 'javascript:alert(1)'
  }
}));
assert.equal(unsafeUrl.code, 'INVALID_URL');

console.log('Phase 263 z3House bridge validation tests passed.');
