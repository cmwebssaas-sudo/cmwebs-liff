// CMWebs V3 z3House public-listing event bridge (local candidate only).
//
// This endpoint is server-to-server. It accepts a signed, allowlisted public
// listing snapshot and keeps the CMWebs room binding separate from all
// tenant, contract, billing, repair, and payment records.

const V3_Z3HOUSE_BRIDGE_ACTION_ = 'z3house_listing_event';
const V3_Z3HOUSE_BRIDGE_SECRET_PROPERTY_ =
  'CMWEBS_Z3HOUSE_BRIDGE_HMAC_SECRET';
const V3_Z3HOUSE_BRIDGE_MAX_AGE_SECONDS_ = 300;
const V3_Z3HOUSE_BRIDGE_MAX_TEXT_ = 20000;
const V3_Z3HOUSE_BRIDGE_MAX_PHOTOS_ = 20;

const V3_Z3HOUSE_BRIDGE_SHEETS_ = {
  integrations: 'V3_listing_integrations',
  snapshots: 'V3_listing_integration_snapshots',
  events: 'V3_listing_integration_events'
};

const V3_Z3HOUSE_BRIDGE_HEADERS_ = {
  integrations: [
    'integration_id',
    'workspace_id',
    'room_id',
    'z3house_organization_id',
    'z3house_site_id',
    'z3house_listing_id',
    'binding_status',
    'last_synced_at',
    'external_revision',
    'created_at',
    'updated_at',
    'unbound_at',
    'unbound_reason'
  ],
  snapshots: [
    'snapshot_id',
    'workspace_id',
    'room_id',
    'z3house_listing_id',
    'title',
    'summary',
    'description',
    'monthly_price',
    'management_fee',
    'electricity_fee',
    'availability',
    'published',
    'thumbnail_url',
    'independent_site_url',
    'photos_json',
    'external_revision',
    'updated_at',
    'synced_at'
  ],
  events: [
    'event_id',
    'event_type',
    'workspace_id',
    'room_id',
    'z3house_organization_id',
    'z3house_site_id',
    'z3house_listing_id',
    'external_revision',
    'occurred_at',
    'received_at',
    'nonce',
    'payload_hash',
    'result',
    'reason'
  ]
};

const V3_Z3HOUSE_BRIDGE_EVENT_TYPES_ = [
  'listing.snapshot',
  'publication.hidden',
  'binding.unbound'
];


function z3houseListingBridgeIsRequest_(postBody) {
  try {
    const payload = JSON.parse(String(postBody || ''));
    return payload && payload.action === V3_Z3HOUSE_BRIDGE_ACTION_;
  } catch (error) {
    return false;
  }
}


function handleZ3houseListingBridgePost_(postBody, signature) {
  let payload = null;

  try {
    payload = JSON.parse(String(postBody || ''));
  } catch (error) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_JSON',
      '房源同步資料不是有效 JSON'
    );
  }

  if (!payload || payload.action !== V3_Z3HOUSE_BRIDGE_ACTION_) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_ACTION',
      '不支援的房源同步動作'
    );
  }

  const authentication = z3houseListingBridgeVerifyRequest_(
    postBody,
    payload,
    signature
  );

  if (!authentication.success) {
    return authentication;
  }

  const validation = z3houseListingBridgeValidatePayload_(payload);

  if (!validation.success) {
    return validation;
  }

  return z3houseListingBridgeApplyEvent_(
    postBody,
    validation.data
  );
}


function z3houseListingBridgeVerifyRequest_(postBody, payload, signature) {
  const timestamp = Number(payload && payload.timestamp);
  const now = Math.floor(Date.now() / 1000);

  if (
    !Number.isInteger(timestamp) ||
    timestamp <= 0 ||
    Math.abs(now - timestamp) >
      V3_Z3HOUSE_BRIDGE_MAX_AGE_SECONDS_
  ) {
    return z3houseListingBridgeResult_(
      false,
      'EXPIRED_TIMESTAMP',
      '房源同步請求時間已過期或格式不正確'
    );
  }

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty(V3_Z3HOUSE_BRIDGE_SECRET_PROPERTY_);

  if (!secret) {
    return z3houseListingBridgeResult_(
      false,
      'BRIDGE_SECRET_NOT_CONFIGURED',
      '尚未設定房源同步驗證密鑰'
    );
  }

  const expected = z3houseListingBridgeComputeHmacHex_(
    postBody,
    secret
  );

  if (
    !z3houseListingBridgeConstantTimeEquals_(
      expected,
      z3houseListingBridgeText_(signature).toLowerCase()
    )
  ) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_SIGNATURE',
      '房源同步請求簽章不正確'
    );
  }

  return z3houseListingBridgeResult_(true, 'OK', '驗證成功');
}


function z3houseListingBridgeValidatePayload_(payload) {
  const allowedRoot = [
    'action',
    'timestamp',
    'nonce',
    'event_id',
    'event_type',
    'occurred_at',
    'binding',
    'source',
    'listing'
  ];

  if (z3houseListingBridgeContainsForbiddenKey_(payload)) {
    return z3houseListingBridgeResult_(
      false,
      'FORBIDDEN_DATA',
      '房源同步資料含有不允許的營運或個人欄位'
    );
  }

  const rootKeys = z3houseListingBridgeValidateObjectKeys_(
    payload,
    allowedRoot,
    'payload'
  );

  if (!rootKeys.success) {
    return rootKeys;
  }

  const eventType = z3houseListingBridgeText_(payload.event_type);

  if (V3_Z3HOUSE_BRIDGE_EVENT_TYPES_.indexOf(eventType) < 0) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_EVENT_TYPE',
      '不支援的房源事件類型'
    );
  }

  const nonce = z3houseListingBridgeRequiredText_(
    payload.nonce,
    'nonce',
    160
  );
  const eventId = z3houseListingBridgeRequiredText_(
    payload.event_id,
    'event_id',
    160
  );
  const occurredAt = z3houseListingBridgeDateText_(
    payload.occurred_at,
    'occurred_at'
  );
  const binding = z3houseListingBridgeValidateBinding_(payload.binding);
  const source = z3houseListingBridgeValidateSource_(payload.source);

  for (const item of [nonce, eventId, occurredAt, binding, source]) {
    if (!item.success) {
      return item;
    }
  }

  const listing = z3houseListingBridgeValidateListing_(
    payload.listing,
    eventType === 'listing.snapshot'
  );

  if (!listing.success) {
    return listing;
  }

  return z3houseListingBridgeResult_(
    true,
    'OK',
    '房源同步資料驗證成功',
    {
      action: V3_Z3HOUSE_BRIDGE_ACTION_,
      timestamp: Number(payload.timestamp),
      nonce: nonce.data,
      event_id: eventId.data,
      event_type: eventType,
      occurred_at: occurredAt.data,
      binding: binding.data,
      source: source.data,
      listing: listing.data
    }
  );
}


function z3houseListingBridgeValidateBinding_(binding) {
  const keys = z3houseListingBridgeValidateObjectKeys_(
    binding,
    ['workspace_id', 'room_id'],
    'binding'
  );

  if (!keys.success) {
    return keys;
  }

  const workspaceId = z3houseListingBridgeRequiredText_(
    binding && binding.workspace_id,
    'binding.workspace_id',
    160
  );
  const roomId = z3houseListingBridgeRequiredText_(
    binding && binding.room_id,
    'binding.room_id',
    160
  );

  if (!workspaceId.success) return workspaceId;
  if (!roomId.success) return roomId;

  return z3houseListingBridgeResult_(
    true,
    'OK',
    'binding validated',
    {
      workspace_id: workspaceId.data,
      room_id: roomId.data
    }
  );
}


function z3houseListingBridgeValidateSource_(source) {
  const keys = z3houseListingBridgeValidateObjectKeys_(
    source,
    [
      'organization_id',
      'site_id',
      'listing_id',
      'revision',
      'updated_at'
    ],
    'source'
  );

  if (!keys.success) {
    return keys;
  }

  const organizationId = z3houseListingBridgeRequiredText_(
    source && source.organization_id,
    'source.organization_id',
    160
  );
  const siteId = z3houseListingBridgeRequiredText_(
    source && source.site_id,
    'source.site_id',
    160
  );
  const listingId = z3houseListingBridgeRequiredText_(
    source && source.listing_id,
    'source.listing_id',
    240
  );
  const revision = z3houseListingBridgeRequiredText_(
    source && source.revision,
    'source.revision',
    240
  );
  const updatedAt = source && source.updated_at === undefined
    ? z3houseListingBridgeResult_(true, 'OK', 'optional', '')
    : z3houseListingBridgeDateText_(
        source && source.updated_at,
        'source.updated_at'
      );

  for (const item of [
    organizationId,
    siteId,
    listingId,
    revision,
    updatedAt
  ]) {
    if (!item.success) return item;
  }

  return z3houseListingBridgeResult_(
    true,
    'OK',
    'source validated',
    {
      organization_id: organizationId.data,
      site_id: siteId.data,
      listing_id: listingId.data,
      revision: revision.data,
      updated_at: updatedAt.data
    }
  );
}


function z3houseListingBridgeValidateListing_(listing, required) {
  if (listing === undefined || listing === null) {
    if (required) {
      return z3houseListingBridgeResult_(
        false,
        'LISTING_REQUIRED',
        '公開快照事件缺少房源資料'
      );
    }

    return z3houseListingBridgeResult_(true, 'OK', 'optional', null);
  }

  const keys = z3houseListingBridgeValidateObjectKeys_(
    listing,
    [
      'title',
      'summary',
      'description',
      'monthly_price',
      'management_fee',
      'electricity_fee',
      'availability',
      'published',
      'thumbnail_url',
      'independent_site_url',
      'photos'
    ],
    'listing'
  );

  if (!keys.success) {
    return keys;
  }

  const title = z3houseListingBridgeOptionalText_(
    listing.title,
    'listing.title',
    240
  );
  const summary = z3houseListingBridgeOptionalText_(
    listing.summary,
    'listing.summary',
    1000
  );
  const description = z3houseListingBridgeOptionalText_(
    listing.description,
    'listing.description',
    V3_Z3HOUSE_BRIDGE_MAX_TEXT_
  );
  const monthlyPrice = z3houseListingBridgeMoney_(
    listing.monthly_price,
    'listing.monthly_price'
  );
  const managementFee = z3houseListingBridgeDisplayValue_(
    listing.management_fee,
    'listing.management_fee'
  );
  const electricityFee = z3houseListingBridgeDisplayValue_(
    listing.electricity_fee,
    'listing.electricity_fee'
  );
  const availability = z3houseListingBridgeAvailability_(
    listing.availability,
    required
  );
  const published = z3houseListingBridgeBoolean_(
    listing.published,
    required
  );
  const thumbnailUrl = z3houseListingBridgeOptionalUrl_(
    listing.thumbnail_url,
    'listing.thumbnail_url'
  );
  const independentSiteUrl = z3houseListingBridgeOptionalUrl_(
    listing.independent_site_url,
    'listing.independent_site_url'
  );
  const photos = z3houseListingBridgePhotos_(listing.photos);

  for (const item of [
    title,
    summary,
    description,
    monthlyPrice,
    managementFee,
    electricityFee,
    availability,
    published,
    thumbnailUrl,
    independentSiteUrl,
    photos
  ]) {
    if (!item.success) return item;
  }

  if (required && !title.data) {
    return z3houseListingBridgeResult_(
      false,
      'TITLE_REQUIRED',
      '公開快照事件缺少房源名稱'
    );
  }

  return z3houseListingBridgeResult_(
    true,
    'OK',
    'listing validated',
    {
      title: title.data,
      summary: summary.data,
      description: description.data,
      monthly_price: monthlyPrice.data,
      management_fee: managementFee.data,
      electricity_fee: electricityFee.data,
      availability: availability.data,
      published: published.data,
      thumbnail_url: thumbnailUrl.data,
      independent_site_url: independentSiteUrl.data,
      photos: photos.data
    }
  );
}


function z3houseListingBridgePhotos_(photos) {
  if (photos === undefined || photos === null) {
    return z3houseListingBridgeResult_(true, 'OK', 'empty', []);
  }

  if (!Array.isArray(photos)) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_PHOTOS',
      '房源照片格式不正確'
    );
  }

  if (photos.length > V3_Z3HOUSE_BRIDGE_MAX_PHOTOS_) {
    return z3houseListingBridgeResult_(
      false,
      'TOO_MANY_PHOTOS',
      '房源照片數量超過上限'
    );
  }

  const normalized = [];

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const keys = z3houseListingBridgeValidateObjectKeys_(
      photo,
      ['photo_url', 'sort_order', 'alt'],
      'listing.photos[' + index + ']'
    );

    if (!keys.success) return keys;

    const url = z3houseListingBridgeRequiredUrl_(
      photo && photo.photo_url,
      'listing.photos[' + index + '].photo_url'
    );
    const alt = z3houseListingBridgeOptionalText_(
      photo && photo.alt,
      'listing.photos[' + index + '].alt',
      500
    );
    const sortOrder = photo && photo.sort_order;

    if (!url.success) return url;
    if (!alt.success) return alt;

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > V3_Z3HOUSE_BRIDGE_MAX_PHOTOS_
    ) {
      return z3houseListingBridgeResult_(
        false,
        'INVALID_PHOTO_ORDER',
        '房源照片排序格式不正確'
      );
    }

    normalized.push({
      photo_url: url.data,
      sort_order: sortOrder,
      alt: alt.data
    });
  }

  normalized.sort(function (left, right) {
    return left.sort_order - right.sort_order;
  });

  return z3houseListingBridgeResult_(
    true,
    'OK',
    'photos validated',
    normalized
  );
}


function z3houseListingBridgeApplyEvent_(postBody, payload) {
  let lock = null;

  try {
    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const ss = runtimeSpreadsheet_();
    const sheets = z3houseListingBridgeEnsureSheets_(ss);
    const payloadHash = z3houseListingBridgeSha256Hex_(postBody);
    const events = workspaceGetObjectsWithRow_(sheets.events);
    const existingEvent = events.find(function (row) {
      return z3houseListingBridgeText_(row.event_id) ===
        payload.event_id;
    });

    if (existingEvent) {
      if (
        z3houseListingBridgeText_(existingEvent.payload_hash) ===
        payloadHash
      ) {
        return z3houseListingBridgeResult_(
          true,
          'IDEMPOTENT',
          '房源事件已處理，略過重複寫入',
          z3houseListingBridgeResponseData_(
            payload,
            existingEvent.result || 'applied',
            true
          )
        );
      }

      return z3houseListingBridgeResult_(
        false,
        'IDEMPOTENCY_CONFLICT',
        '相同 event_id 對應不同內容，拒絕覆寫'
      );
    }

    const nonceReplay = events.find(function (row) {
      return z3houseListingBridgeText_(row.nonce) === payload.nonce &&
        z3houseListingBridgeText_(row.event_id) !== payload.event_id;
    });

    if (nonceReplay) {
      return z3houseListingBridgeResult_(
        false,
        'NONCE_REPLAY',
        '房源同步 nonce 已被其他事件使用'
      );
    }

    const room = z3houseListingBridgeFindRoom_(
      ss,
      payload.binding.workspace_id,
      payload.binding.room_id
    );

    if (!room) {
      return z3houseListingBridgeResult_(
        false,
        'ROOM_NOT_IN_WORKSPACE',
        '房間不屬於指定 Workspace，拒絕建立房源同步'
      );
    }

    const integrations = workspaceGetObjectsWithRow_(
      sheets.integrations
    );
    const activeIntegration =
      z3houseListingBridgeFindActiveIntegration_(
        integrations,
        payload.binding.workspace_id,
        payload.binding.room_id
      );
    const activeListingIntegration =
      z3houseListingBridgeFindActiveListingIntegration_(
        integrations,
        payload.binding.workspace_id,
        payload.source.listing_id
      );
    const now = new Date().toISOString();
    let integration = activeIntegration;
    let bindingStatus = 'bound';
    let result = 'applied';

    if (payload.event_type === 'listing.snapshot') {
      if (
        activeIntegration &&
        z3houseListingBridgeText_(
          activeIntegration.z3house_listing_id
        ) !== payload.source.listing_id
      ) {
        return z3houseListingBridgeResult_(
          false,
          'BINDING_CONFLICT',
          '房間已有不同的 z3House 房源綁定'
        );
      }

      if (
        activeListingIntegration &&
        z3houseListingBridgeText_(
          activeListingIntegration.room_id
        ) !== payload.binding.room_id
      ) {
        return z3houseListingBridgeResult_(
          false,
          'LISTING_ALREADY_BOUND',
          'z3House 房源已綁定其他房間'
        );
      }

      const integrationRecord =
        z3houseListingBridgeIntegrationRecord_(
          payload,
          integration,
          now,
          'bound'
        );

      if (integration) {
        z3houseListingBridgeUpdateRow_(
          sheets.integrations,
          integration.__row_number,
          integrationRecord
        );
      } else {
        workspaceAppendObject_(sheets.integrations, integrationRecord);
      }

      z3houseListingBridgeWriteSnapshot_(
        sheets.snapshots,
        payload,
        now
      );
    } else {
      if (
        !integration ||
        z3houseListingBridgeText_(
          integration.z3house_listing_id
        ) !== payload.source.listing_id
      ) {
        if (payload.event_type === 'binding.unbound') {
          z3houseListingBridgeAppendEvent_(
            sheets.events,
            payload,
            payloadHash,
            now,
            'already_unbound',
            '目前沒有可解除的有效綁定'
          );
          return z3houseListingBridgeResult_(
            true,
            'ALREADY_UNBOUND',
            '房源綁定原本就是解除狀態',
            z3houseListingBridgeResponseData_(
              payload,
              'already_unbound',
              false
            )
          );
        }

        return z3houseListingBridgeResult_(
          false,
          'BINDING_NOT_FOUND',
          '找不到可更新的房源綁定'
        );
      }

      if (payload.event_type === 'publication.hidden') {
        const record = z3houseListingBridgeIntegrationRecord_(
          payload,
          integration,
          now,
          'bound'
        );
        z3houseListingBridgeUpdateRow_(
          sheets.integrations,
          integration.__row_number,
          record
        );
        z3houseListingBridgeHideLatestSnapshot_(
          sheets.snapshots,
          payload,
          now
        );
        bindingStatus = 'bound';
      } else {
        const record = z3houseListingBridgeIntegrationRecord_(
          payload,
          integration,
          now,
          'unbound'
        );
        record.unbound_at = now;
        record.unbound_reason = 'external_event';
        z3houseListingBridgeUpdateRow_(
          sheets.integrations,
          integration.__row_number,
          record
        );
        z3houseListingBridgeHideLatestSnapshot_(
          sheets.snapshots,
          payload,
          now
        );
        bindingStatus = 'unbound';
      }
    }

    z3houseListingBridgeAppendEvent_(
      sheets.events,
      payload,
      payloadHash,
      now,
      result,
      ''
    );

    return z3houseListingBridgeResult_(
      true,
      'OK',
      '房源公開資料同步完成',
      z3houseListingBridgeResponseData_(
        payload,
        bindingStatus,
        false
      )
    );
  } catch (error) {
    return z3houseListingBridgeResult_(
      false,
      'Z3HOUSE_BRIDGE_ERROR',
      '房源公開資料同步處理失敗'
    );
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // Best-effort release only.
      }
    }
  }
}


function z3houseListingBridgeEnsureSheets_(ss) {
  return {
    integrations: workspaceEnsureSheet_(
      ss,
      V3_Z3HOUSE_BRIDGE_SHEETS_.integrations,
      V3_Z3HOUSE_BRIDGE_HEADERS_.integrations
    ),
    snapshots: workspaceEnsureSheet_(
      ss,
      V3_Z3HOUSE_BRIDGE_SHEETS_.snapshots,
      V3_Z3HOUSE_BRIDGE_HEADERS_.snapshots
    ),
    events: workspaceEnsureSheet_(
      ss,
      V3_Z3HOUSE_BRIDGE_SHEETS_.events,
      V3_Z3HOUSE_BRIDGE_HEADERS_.events
    )
  };
}


function z3houseListingBridgeFindRoom_(ss, workspaceId, roomId) {
  const access = {
    workspace: {
      workspace_id: workspaceId
    },
    principals: []
  };
  const rooms = propertyRoomGetWorkspaceRooms_(ss, access, true);

  return rooms.find(function (room) {
    return z3houseListingBridgeText_(room.room_id) === roomId;
  }) || null;
}


function z3houseListingBridgeFindActiveIntegration_(
  rows,
  workspaceId,
  roomId
) {
  return rows
    .filter(function (row) {
      return z3houseListingBridgeWorkspace_(row.workspace_id) ===
        z3houseListingBridgeWorkspace_(workspaceId) &&
        z3houseListingBridgeText_(row.room_id) === roomId &&
        z3houseListingBridgeText_(row.binding_status).toLowerCase() ===
          'bound';
    })
    .sort(z3houseListingBridgeLatestRow_)
    .pop() || null;
}


function z3houseListingBridgeFindActiveListingIntegration_(
  rows,
  workspaceId,
  listingId
) {
  return rows
    .filter(function (row) {
      return z3houseListingBridgeWorkspace_(row.workspace_id) ===
        z3houseListingBridgeWorkspace_(workspaceId) &&
        z3houseListingBridgeText_(row.z3house_listing_id) === listingId &&
        z3houseListingBridgeText_(row.binding_status).toLowerCase() ===
          'bound';
    })
    .sort(z3houseListingBridgeLatestRow_)
    .pop() || null;
}


function z3houseListingBridgeFindLatestSnapshot_(
  sheet,
  workspaceId,
  roomId,
  listingId
) {
  return workspaceGetObjectsWithRow_(sheet)
    .filter(function (row) {
      return z3houseListingBridgeWorkspace_(row.workspace_id) ===
        z3houseListingBridgeWorkspace_(workspaceId) &&
        z3houseListingBridgeText_(row.room_id) === roomId &&
        z3houseListingBridgeText_(row.z3house_listing_id) === listingId;
    })
    .sort(z3houseListingBridgeLatestRow_)
    .pop() || null;
}


function z3houseListingBridgeLatestRow_(left, right) {
  return Number(left.__row_number || 0) -
    Number(right.__row_number || 0);
}


function z3houseListingBridgeIntegrationRecord_(
  payload,
  existing,
  now,
  status
) {
  return {
    integration_id: existing
      ? z3houseListingBridgeText_(existing.integration_id)
      : 'V3INT-' + Utilities.getUuid(),
    workspace_id: payload.binding.workspace_id,
    room_id: payload.binding.room_id,
    z3house_organization_id: payload.source.organization_id,
    z3house_site_id: payload.source.site_id,
    z3house_listing_id: payload.source.listing_id,
    binding_status: status,
    last_synced_at: now,
    external_revision: payload.source.revision,
    created_at: existing
      ? z3houseListingBridgeText_(existing.created_at)
      : now,
    updated_at: now,
    unbound_at: status === 'unbound'
      ? now
      : existing
        ? z3houseListingBridgeText_(existing.unbound_at)
        : '',
    unbound_reason: status === 'unbound'
      ? 'external_event'
      : existing
        ? z3houseListingBridgeText_(existing.unbound_reason)
        : ''
  };
}


function z3houseListingBridgeWriteSnapshot_(sheet, payload, now) {
  const listing = payload.listing || {
    title: '',
    summary: '',
    description: '',
    monthly_price: '',
    management_fee: '',
    electricity_fee: '',
    availability: '',
    published: false,
    thumbnail_url: '',
    independent_site_url: '',
    photos: []
  };
  const existing = z3houseListingBridgeFindLatestSnapshot_(
    sheet,
    payload.binding.workspace_id,
    payload.binding.room_id,
    payload.source.listing_id
  );
  const record = {
    snapshot_id: existing
      ? z3houseListingBridgeText_(existing.snapshot_id)
      : 'V3SNAP-' + Utilities.getUuid(),
    workspace_id: payload.binding.workspace_id,
    room_id: payload.binding.room_id,
    z3house_listing_id: payload.source.listing_id,
    title: listing.title,
    summary: listing.summary,
    description: listing.description,
    monthly_price: listing.monthly_price,
    management_fee: listing.management_fee,
    electricity_fee: listing.electricity_fee,
    availability: listing.availability,
    published: listing.published === true,
    thumbnail_url: listing.thumbnail_url,
    independent_site_url: listing.independent_site_url,
    photos_json: JSON.stringify(listing.photos || []),
    external_revision: payload.source.revision,
    updated_at: payload.source.updated_at || now,
    synced_at: now
  };

  if (existing) {
    z3houseListingBridgeUpdateRow_(
      sheet,
      existing.__row_number,
      record
    );
  } else {
    workspaceAppendObject_(sheet, record);
  }
}


function z3houseListingBridgeHideLatestSnapshot_(sheet, payload, now) {
  const existing = z3houseListingBridgeFindLatestSnapshot_(
    sheet,
    payload.binding.workspace_id,
    payload.binding.room_id,
    payload.source.listing_id
  );

  if (!existing) return;

  z3houseListingBridgeUpdateRow_(
    sheet,
    existing.__row_number,
    {
      published: false,
      external_revision: payload.source.revision,
      updated_at: payload.source.updated_at || now,
      synced_at: now
    }
  );
}


function z3houseListingBridgeUpdateRow_(sheet, rowNumber, record) {
  const map = workspaceHeaderMap_(sheet);

  Object.keys(record).forEach(function (key) {
    if (map[key] === undefined) return;
    sheet.getRange(rowNumber, map[key] + 1).setValue(record[key]);
  });
}


function z3houseListingBridgeAppendEvent_(
  sheet,
  payload,
  payloadHash,
  now,
  result,
  reason
) {
  workspaceAppendObject_(sheet, {
    event_id: payload.event_id,
    event_type: payload.event_type,
    workspace_id: payload.binding.workspace_id,
    room_id: payload.binding.room_id,
    z3house_organization_id: payload.source.organization_id,
    z3house_site_id: payload.source.site_id,
    z3house_listing_id: payload.source.listing_id,
    external_revision: payload.source.revision,
    occurred_at: payload.occurred_at,
    received_at: now,
    nonce: payload.nonce,
    payload_hash: payloadHash,
    result: result,
    reason: reason || ''
  });
}


function z3houseListingBridgeResponseData_(payload, status, idempotent) {
  const bindingStatus = status === 'already_unbound'
    ? 'unbound'
    : status;

  return {
    event_id: payload.event_id,
    workspace_id: payload.binding.workspace_id,
    room_id: payload.binding.room_id,
    z3house_listing_id: payload.source.listing_id,
    binding_status: bindingStatus,
    publication_status: payload.event_type === 'listing.snapshot' &&
      payload.listing &&
      payload.listing.published === true &&
      payload.listing.availability === 'available'
      ? 'published'
      : 'hidden',
    idempotent: idempotent === true
  };
}


function z3houseListingBridgeValidateObjectKeys_(object, allowed, path) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_OBJECT',
      path + ' 格式不正確'
    );
  }

  const unknown = Object.keys(object).find(function (key) {
    return allowed.indexOf(key) < 0;
  });

  if (unknown) {
    return z3houseListingBridgeResult_(
      false,
      'UNSUPPORTED_FIELD',
      path + ' 含有不支援欄位'
    );
  }

  return z3houseListingBridgeResult_(true, 'OK', 'keys validated');
}


function z3houseListingBridgeContainsForbiddenKey_(value) {
  const blocked = [
    ['tenant', '_', 'name'].join(''),
    ['tenant', '_', 'phone'].join(''),
    ['tenant', '_', 'email'].join(''),
    ['contract', '_', 'id'].join(''),
    ['bill', '_', 'id'].join(''),
    ['de', 'posit'].join(''),
    ['repair', '_', 'description'].join(''),
    ['payment', '_', 'account'].join('')
  ];

  function visit(current) {
    if (!current || typeof current !== 'object') return false;

    return Object.keys(current).some(function (key) {
      const normalized = String(key)
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase();

      return blocked.indexOf(normalized) >= 0 || visit(current[key]);
    });
  }

  return visit(value);
}


function z3houseListingBridgeRequiredText_(value, field, max) {
  const normalized = z3houseListingBridgeOptionalText_(value, field, max);

  if (!normalized.success) return normalized;

  if (!normalized.data) {
    return z3houseListingBridgeResult_(
      false,
      'MISSING_FIELD',
      field + ' 不得為空'
    );
  }

  return normalized;
}


function z3houseListingBridgeOptionalText_(value, field, max) {
  if (value === undefined || value === null || value === '') {
    return z3houseListingBridgeResult_(true, 'OK', 'optional', '');
  }

  if (typeof value === 'object') {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_FIELD',
      field + ' 格式不正確'
    );
  }

  const text = String(value).trim();

  if (text.length > max) {
    return z3houseListingBridgeResult_(
      false,
      'FIELD_TOO_LONG',
      field + ' 超過長度上限'
    );
  }

  return z3houseListingBridgeResult_(true, 'OK', 'text validated', text);
}


function z3houseListingBridgeDateText_(value, field) {
  const normalized = z3houseListingBridgeRequiredText_(
    value,
    field,
    80
  );

  if (!normalized.success) return normalized;

  if (isNaN(Date.parse(normalized.data))) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_DATE',
      field + ' 不是有效日期'
    );
  }

  return normalized;
}


function z3houseListingBridgeRequiredUrl_(value, field) {
  const normalized = z3houseListingBridgeRequiredText_(
    value,
    field,
    2000
  );

  if (!normalized.success) return normalized;

  if (!/^https:\/\/[^\s"'<>]+$/i.test(normalized.data)) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_URL',
      field + ' 只接受 HTTPS 網址'
    );
  }

  return normalized;
}


function z3houseListingBridgeOptionalUrl_(value, field) {
  if (value === undefined || value === null || value === '') {
    return z3houseListingBridgeResult_(true, 'OK', 'optional', '');
  }

  return z3houseListingBridgeRequiredUrl_(value, field);
}


function z3houseListingBridgeMoney_(value, field) {
  if (value === undefined || value === null || value === '') {
    return z3houseListingBridgeResult_(true, 'OK', 'optional', '');
  }

  if (
    typeof value !== 'number' ||
    !isFinite(value) ||
    value < 0
  ) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_MONEY',
      field + ' 必須是非負數字'
    );
  }

  return z3houseListingBridgeResult_(true, 'OK', 'money validated', value);
}


function z3houseListingBridgeDisplayValue_(value, field) {
  if (value === undefined || value === null || value === '') {
    return z3houseListingBridgeResult_(true, 'OK', 'optional', '');
  }

  if (typeof value === 'number') {
    if (!isFinite(value) || value < 0) {
      return z3houseListingBridgeResult_(
        false,
        'INVALID_DISPLAY_VALUE',
        field + ' 格式不正確'
      );
    }

    return z3houseListingBridgeResult_(true, 'OK', 'display validated', value);
  }

  return z3houseListingBridgeOptionalText_(value, field, 500);
}


function z3houseListingBridgeAvailability_(value, required) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return z3houseListingBridgeResult_(
        false,
        'MISSING_FIELD',
        'listing.availability 不得為空'
      );
    }

    return z3houseListingBridgeResult_(true, 'OK', 'optional', '');
  }

  const normalized = String(value).trim().toLowerCase();

  if (['available', 'rented'].indexOf(normalized) < 0) {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_AVAILABILITY',
      'listing.availability 格式不正確'
    );
  }

  return z3houseListingBridgeResult_(
    true,
    'OK',
    'availability validated',
    normalized
  );
}


function z3houseListingBridgeBoolean_(value, required) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return z3houseListingBridgeResult_(
        false,
        'MISSING_FIELD',
        'listing.published 不得為空'
      );
    }

    return z3houseListingBridgeResult_(true, 'OK', 'optional', false);
  }

  if (typeof value !== 'boolean') {
    return z3houseListingBridgeResult_(
      false,
      'INVALID_BOOLEAN',
      'listing.published 格式不正確'
    );
  }

  return z3houseListingBridgeResult_(true, 'OK', 'boolean validated', value);
}


function z3houseListingBridgeWorkspace_(value) {
  return z3houseListingBridgeText_(value).toUpperCase();
}


function z3houseListingBridgeText_(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return '';

  const text = String(value).trim();
  return max && text.length > max ? text.slice(0, max) : text;
}


function z3houseListingBridgeComputeHmacHex_(body, secret) {
  const bytes = Utilities.computeHmacSha256Signature(
    String(body || ''),
    String(secret || '')
  );

  return bytes.map(function (value) {
    const normalized = value < 0 ? value + 256 : value;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}


function z3houseListingBridgeSha256Hex_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || '')
  );

  return bytes.map(function (value) {
    const normalized = value < 0 ? value + 256 : value;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}


function z3houseListingBridgeConstantTimeEquals_(left, right) {
  left = String(left || '');
  right = String(right || '');

  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}


function z3houseListingBridgeResult_(success, code, message, data) {
  return {
    success: success === true,
    code: code || '',
    message: message || '',
    data: data === undefined ? null : data
  };
}
