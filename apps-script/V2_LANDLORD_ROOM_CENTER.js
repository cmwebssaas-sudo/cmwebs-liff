/**
 * CMWebs production landlord room center.
 *
 * This is a deliberately narrow, read-only projection of the authenticated
 * Workspace's rooms. It must not reuse landlord_properties_init because that
 * response also contains contract, bill, owner, and tenant-facing fields.
 *
 * Route:
 * - landlord_room_center_init
 */

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

    const safeRooms = rooms.map(function (room) {
      const propertyId = propertyRoomText_(room.property_id);
      const property = propertyById[propertyId] || {};
      return {
        room_id: propertyRoomText_(room.room_id),
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
        )
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
