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
    if (!item || item.binding_status === 'unbound') return;

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

    const safeRooms = rooms.map(function (room) {
      const propertyId = propertyRoomText_(room.property_id);
      const property = propertyById[propertyId] || {};
      const roomId = propertyRoomText_(room.room_id);
      return {
        room_id: roomId,
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
