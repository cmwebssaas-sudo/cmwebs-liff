/**
 * CMWebs production landlord room center.
 *
 * This is a deliberately narrow, read-only projection of the authenticated
 * Workspace's rooms. It must not reuse landlord_properties_init because that
 * response also contains contract, bill, owner, and tenant-facing fields.
 *
 * Route:
 * - landlord_room_center_init
 *
 * Optional z3House bridge projection:
 * - V3_listing_integrations: room binding metadata only
 * - V3_listing_integration_snapshots: public listing snapshot only
 *
 * These sheets are intentionally optional. A new CMWebs landlord can create
 * rooms before the external bridge is provisioned; the response then exposes
 * an explicit unbound state instead of guessing an external listing ID.
 */

const LANDLORD_ROOM_CENTER_Z3HOUSE_SHEETS_ = {
  integrations: 'V3_listing_integrations',
  snapshots: 'V3_listing_integration_snapshots'
};


function landlordRoomCenterOptionalRows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet && typeof workspaceGetObjectsWithRow_ === 'function'
    ? workspaceGetObjectsWithRow_(sheet)
    : [];
}


function landlordRoomCenterHttpsUrl_(value) {
  const url = propertyRoomText_(value);
  return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : '';
}

// Only public room-detail pages on z3House are eligible for server-side reads.
// Never fetch arbitrary landlord URLs, admin pages, credentials or redirects.
function landlordRoomWebsiteCoverTarget_(value) {
  const match = propertyRoomText_(value).match(/^https:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.z3house\.com)(\/spaces\/[a-z0-9_-]+\/?)(?:[?#][^\s"'<>\\]*)?$/i);
  if (!match || match[1].toLowerCase() === 'admin.z3house.com') return null;
  const origin = 'https://' + match[1].toLowerCase();
  return { origin: origin, url: origin + match[2] };
}

function landlordRoomWebsiteCoverFromHtml_(html, target) {
  return landlordRoomWebsitePhotosFromHtml_(html, target)[0] || '';
}

function landlordRoomWebsitePhotosFromHtml_(html, target) {
  if (!html || html.length > 1000000) return [];
  const section = html.match(/<section\b[^>]*\sclass=["'][^"']*\bspace-detail__media\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
  const photos = [];
  if (!section) return photos;
  const pattern = /<img\b[^>]*\ssrc=["']([^"']+)["']/gi;
  let image;
  while ((image = pattern.exec(section[1])) && photos.length < 100) {
    const url = image[1];
    if (url.indexOf(target.origin + '/api/public/media/') === 0 &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(url.slice((target.origin + '/api/public/media/').length)) && photos.indexOf(url) < 0) photos.push(url);
  }
  return photos;
}

function landlordRoomWebsiteCovers_(values, refresh) {
  const result = {};
  const pending = [];
  const targets = {};
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (_) {}
  values.forEach(function (value) {
    const key = propertyRoomText_(value);
    if (Object.prototype.hasOwnProperty.call(result, key)) return;
    result[key] = { url: '', status: key ? 'unsupported' : 'none' };
    const target = landlordRoomWebsiteCoverTarget_(key);
    if (!target) return;
    result[key].status = 'unavailable';
    if (!targets[target.url]) {
      const item = { target: target, keys: [], cacheKey: '' };
      try {
        item.cacheKey = 'room-gallery-v2:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, target.url));
        const cached = !refresh && cache && cache.get(item.cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (['available', 'missing', 'unavailable'].indexOf(parsed.status) >= 0 &&
              Array.isArray(parsed.photos) && parsed.photos.length <= 100 &&
              parsed.photos.every(function (url) { return typeof url === 'string' && landlordRoomWebsiteCoverFromHtml_('<section class="space-detail__media"><img src="' + url + '"></section>', target) === url; }) &&
              parsed.url === (parsed.photos[0] || '')) item.cover = parsed;
        }
      } catch (_) {}
      targets[target.url] = item;
      if (!item.cover) pending.push(item);
    }
    targets[target.url].keys.push(key);
  });
  if (pending.length) {
    let responses = [];
    try {
      responses = UrlFetchApp.fetchAll(pending.map(function (item) {
        return { url: item.target.url, method: 'get', followRedirects: false, muteHttpExceptions: true };
      }));
    } catch (_) {}
    pending.forEach(function (item, index) {
      item.cover = { url: '', photos: [], status: 'unavailable' };
      try {
        const response = responses[index];
        if (response && response.getResponseCode() === 200) {
          item.cover.photos = landlordRoomWebsitePhotosFromHtml_(response.getContentText(), item.target);
          item.cover.url = item.cover.photos[0] || '';
          item.cover.status = item.cover.url ? 'available' : 'missing';
        }
      } catch (_) {}
      // Public image URLs only; no HTML, identity or financial data in cache.
      try { if (cache && item.cacheKey) cache.put(item.cacheKey, JSON.stringify(item.cover), item.cover.url ? 21600 : 60); } catch (_) {}
    });
  }
  Object.keys(targets).forEach(function (url) {
    targets[url].keys.forEach(function (key) { result[key] = targets[url].cover; });
  });
  return result;
}


function landlordRoomCenterBoolean_(value) {
  if (value === true) return true;
  return ['1', 'true', 'yes', 'published', '公開'].indexOf(
    propertyRoomText_(value).toLowerCase()
  ) >= 0;
}


function landlordRoomCenterZ3houseDefault_() {
  return {
    binding_status: 'unbound',
    publication_status: 'not_connected',
    z3house_organization_id: '',
    z3house_site_id: '',
    z3house_listing_id: '',
    last_synced_at: '',
    external_revision: '',
    title: '',
    thumbnail_url: '',
    independent_site_url: '',
    availability: '',
    published: false,
    updated_at: ''
  };
}


function landlordRoomCenterZ3houseByRoom_(ss, access) {
  const workspaceId = propertyRoomText_(
    access && access.workspace && access.workspace.workspace_id
  ).toUpperCase();
  const result = {};
  const integrations = landlordRoomCenterOptionalRows_(
    ss,
    LANDLORD_ROOM_CENTER_Z3HOUSE_SHEETS_.integrations
  );
  const snapshots = landlordRoomCenterOptionalRows_(
    ss,
    LANDLORD_ROOM_CENTER_Z3HOUSE_SHEETS_.snapshots
  );

  integrations.forEach(function (row) {
    const rowWorkspaceId = propertyRoomText_(
      row.workspace_id || row.cmwebs_workspace_id
    ).toUpperCase();
    const roomId = propertyRoomText_(row.room_id);
    if (!workspaceId || rowWorkspaceId !== workspaceId || !roomId) return;

    const status = propertyRoomText_(
      row.binding_status || row.state || 'unbound'
    ).toLowerCase();
    const item = landlordRoomCenterZ3houseDefault_();
    item.binding_status = status || 'unbound';
    item.z3house_organization_id = propertyRoomText_(
      row.z3house_organization_id
    );
    item.z3house_site_id = propertyRoomText_(
      row.z3house_site_id
    );
    item.z3house_listing_id = propertyRoomText_(
      row.z3house_listing_id
    );
    item.last_synced_at = propertyRoomText_(
      row.last_synced_at || row.last_sync_at
    );
    item.external_revision = propertyRoomText_(
      row.external_revision || row.last_synced_revision
    );
    result[roomId] = item;
  });

  snapshots.forEach(function (row) {
    const rowWorkspaceId = propertyRoomText_(
      row.workspace_id || row.cmwebs_workspace_id
    ).toUpperCase();
    const roomId = propertyRoomText_(row.room_id);
    if (!workspaceId || rowWorkspaceId !== workspaceId || !roomId) return;

    const item = result[roomId];
    if (!item || item.binding_status !== 'bound') return;
    if (!item.z3house_listing_id || propertyRoomText_(row.z3house_listing_id) !== item.z3house_listing_id) return;

    item.title = propertyRoomText_(row.title || row.listing_title);
    item.thumbnail_url = landlordRoomCenterHttpsUrl_(
      row.thumbnail_url || row.cover_photo_url || row.photo_url
    );
    item.independent_site_url = landlordRoomCenterHttpsUrl_(
      row.independent_site_url || row.site_url || row.public_url
    );
    item.availability = propertyRoomText_(row.availability).toLowerCase();
    item.published = landlordRoomCenterBoolean_(
      row.published || row.is_published
    );
    item.updated_at = propertyRoomText_(row.updated_at);
    item.external_revision = propertyRoomText_(
      row.external_revision || item.external_revision
    );
    item.publication_status = item.published ? 'published' : 'hidden';
  });

  return result;
}

function getLandlordRoomCenterInitByLineUid_(
  lineUserId,
  includeArchived
) {
  try {
    propertyRoomRequireReadSchema_();

    const access = workspaceLandlordResolveAccess_(
      lineUserId,
      {
        require_onboarding: true,
        skip_schema_ensure: true
      }
    );

    if (!access || access.success !== true) {
      return access;
    }

    const ss = runtimeSpreadsheet_();
    const showArchived = propertyRoomBoolean_(includeArchived);
    const properties = propertyRoomGetWorkspaceProperties_(
      ss,
      access,
      true
    );
    const propertyById = {};

    properties.forEach(function (property) {
      const propertyId = propertyRoomText_(property.property_id);
      if (!propertyId) return;
      propertyById[propertyId] = {
        property_name: propertyRoomText_(property.property_name),
        account_status: propertyRoomText_(
          property.account_status || 'active'
        ).toLowerCase()
      };
    });

    const rooms = propertyRoomGetWorkspaceRooms_(
      ss,
      access,
      showArchived
    );
    const z3houseByRoom = landlordRoomCenterZ3houseByRoom_(ss, access);
    const publicUrlByRoom = {};
    rooms.forEach(function (room) {
      const roomId = propertyRoomText_(room.room_id);
      const listing = z3houseByRoom[roomId] || {};
      publicUrlByRoom[roomId] = propertyRoomText_(room.room_website_url) || (listing.binding_status === 'bound' ? propertyRoomText_(listing.independent_site_url) : '');
    });
    const websiteCovers = landlordRoomWebsiteCovers_(Object.keys(publicUrlByRoom).map(function (id) { return publicUrlByRoom[id]; }));

    const safeRooms = rooms.map(function (room) {
      const propertyId = propertyRoomText_(room.property_id);
      const property = propertyById[propertyId] || {};
      const roomId = propertyRoomText_(room.room_id);
      return {
        room_id: roomId,
        room_website_url: landlordRoomCenterHttpsUrl_(room.room_website_url),
        room_website_cover: websiteCovers[publicUrlByRoom[roomId]] || { url: '', status: 'none' },
        property_id: propertyId,
        property_name: propertyRoomText_(
          room.property_name || property.property_name
        ),
        room_name: propertyRoomText_(room.room_name),
        room_status: propertyRoomText_(
          room.room_status || 'vacant'
        ).toLowerCase(),
        account_status: propertyRoomText_(
          room.account_status || 'active'
        ).toLowerCase(),
        rent_amount: propertyRoomNumber_(room.rent_amount),
        management_fee: propertyRoomText_(room.management_fee),
        electricity_fee_rate: propertyRoomNumber_(
          room.electricity_fee_rate ||
          room.electricity_rate ||
          room.power_fee_rate
        ),
        equipment_fee_rate_summer: propertyRoomNumber_(
          room.equipment_fee_rate_summer ||
          room.summer_equipment_fee_rate
        ),
        equipment_fee_rate_regular: propertyRoomNumber_(
          room.equipment_fee_rate_regular ||
          room.regular_equipment_fee_rate
        ),
        z3house: z3houseByRoom[roomId] || landlordRoomCenterZ3houseDefault_()
      };
    });

    safeRooms.sort(function (left, right) {
      const propertyCompare = propertyRoomCompareText_(
        left.property_name,
        right.property_name
      );
      if (propertyCompare !== 0) return propertyCompare;
      return propertyRoomCompareText_(left.room_name, right.room_name);
    });

    return workspaceResult_(
      true,
      'OK',
      '房間清單載入成功',
      {
        workspace: {
          workspace_id: propertyRoomText_(
            access.workspace.workspace_id
          ),
          workspace_name: propertyRoomText_(
            access.workspace.workspace_name
          )
        },
        include_archived: showArchived,
        summary: {
          room_count: safeRooms.length,
          active_count: safeRooms.filter(function (room) {
            return room.account_status === 'active';
          }).length,
          archived_count: safeRooms.filter(function (room) {
            return room.account_status === 'archived';
          }).length
        },
        rooms: safeRooms
      }
    );
  } catch (error) {
    return workspaceResult_(
      false,
      'ROOM_CENTER_INIT_ERROR',
      '房間資料載入失敗：' + error.message
    );
  }
}
function saveLandlordRoomWebsiteByLineUid_(lineUserId, roomId, websiteUrl, expectedWorkspaceId) {
  const lock = LockService.getScriptLock();
  let locked = false;
  let saved;
  try {
    const access = workspaceLandlordResolveAccess_(lineUserId, { require_onboarding: true, workspace_id: propertyRoomText_(expectedWorkspaceId) });
    if (!access.success) return access;
    const permission = propertyRoomRequireWrite_(access);
    if (!permission.success) return permission;
    const url = propertyRoomText_(websiteUrl);
    if (url && (url.length > 2048 || !/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s"'<>\\]*)?$/i.test(url))) {
      return workspaceResult_(false, 'INVALID_ROOM_WEBSITE_URL', '請填寫有效的 HTTPS 網址，不可包含帳號密碼');
    }
    lock.waitLock(20000);
    locked = true;
    const ss = runtimeSpreadsheet_();
    const sheet = ss.getSheetByName('V2_rooms');
    const room = sheet && propertyRoomFindWorkspaceTarget_(sheet, access, 'room_id', propertyRoomText_(roomId));
    if (!room) return workspaceResult_(false, 'ROOM_NOT_FOUND', '找不到房源或無權限修改');
    propertyRoomEnsureSheet_(ss, 'V2_rooms', ['room_website_url']);
    propertyRoomSetValues_(sheet, room.__row_number, { room_website_url: url });
    saved = workspaceResult_(true, 'ROOM_WEBSITE_SAVED', url ? '房源網址已儲存' : '房源網址已清除', {room_id: propertyRoomText_(roomId), room_website_url: url});
  } catch (error) {
    return workspaceResult_(false, 'ROOM_WEBSITE_SAVE_FAILED', '房源網址儲存失敗：' + error.message);
  } finally {
    if (locked) lock.releaseLock();
  }
  // The URL is already committed. Photo lookup must not hold the write lock
  // or turn a successful write into a failure (and encourage resubmission).
  saved.data.room_website_cover = landlordRoomWebsiteCovers_([saved.data.room_website_url], true)[saved.data.room_website_url];
  return saved;
}
function resolveRoomWebsitePrincipal_(request) {
  if (request.landlord_session_token) return resolveLandlordPrincipal_(request, {require_onboarding:true});
  if (!request.id_token) return workspaceResult_(false, 'AUTH_REQUIRED', '請重新登入後儲存房源網址');
  const authenticated = landlordContractSigningReviewAuthenticate_(request.id_token);
  if (!authenticated || !authenticated.success) return authenticated;
  const verified = verifyLandlordContractSigningReviewSessionToken_(authenticated.data.session_token);
  if (!verified || !verified.success) return verified;
  return {success:true,data:{principal_line_user_id:verified.data.line_sub,workspace_id:verified.data.workspace_id}};
}
