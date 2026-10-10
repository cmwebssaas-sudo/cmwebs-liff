/**
 * Admin-only, read-only production tenant runtime validation.
 *
 * This function intentionally accepts no caller-supplied identity and exposes
 * no HTTP route. It reads the configured test tenant through the canonical
 * runtime resolver and returns only aggregate validation flags.
 */
function validateProductionTenantResolverReadOnly() {
  const result = {
    ok: false,
    tenant_resolved: false,
    contract_resolved: false,
    workspace_resolved: false,
    property_resolved: false,
    room_resolved: false,
    home_projection_ok: false,
    bills_payload_ok: false,
    bill_count: 0
  };

  try {
    const lineUserId = String(
      getRequiredScriptProperty_('TEST_TENANT_LINE_UID') || ''
    ).trim();
    const resolved = resolveCanonicalTenantRuntimeByLineUid_(lineUserId);

    if (!resolved || resolved.success !== true || !resolved.data) {
      return result;
    }

    const canonical = resolved.data;
    result.tenant_resolved = Boolean(
      String(canonical.tenant_id || '').trim() && canonical.tenant_row
    );
    result.contract_resolved = Boolean(
      String(canonical.contract_id || '').trim() && canonical.contract_row
    );
    result.workspace_resolved = Boolean(
      String(canonical.workspace_id || '').trim()
    );
    result.property_resolved = Boolean(
      String(canonical.property_id || '').trim() && canonical.property_row
    );
    result.room_resolved = Boolean(
      String(canonical.room_id || '').trim() && canonical.room_row
    );

    const homeProjection = tenantRuntimeHomeData_(
      canonical,
      (canonical.tenant_home_rows || [])[0] || {}
    );
    result.home_projection_ok = Boolean(
      homeProjection &&
      String(homeProjection.tenant_id || '').trim() ===
        String(canonical.tenant_id || '').trim() &&
      String(homeProjection.room_list || '').trim()
    );

    const billsPayload = getTenantBillsRuntimePayloadByLineUid_(lineUserId);
    const bills = billsPayload && Array.isArray(billsPayload.bills)
      ? billsPayload.bills
      : [];
    const billCount = billsPayload && typeof billsPayload.count === 'number'
      ? billsPayload.count
      : bills.length;

    result.bill_count = billCount;
    result.bills_payload_ok = Boolean(
      billsPayload &&
      billsPayload.ok === true &&
      billsPayload.success === true &&
      Array.isArray(billsPayload.bills) &&
      billCount === bills.length
    );

    result.ok =
      result.tenant_resolved &&
      result.contract_resolved &&
      result.workspace_resolved &&
      result.property_resolved &&
      result.room_resolved &&
      result.home_projection_ok &&
      result.bills_payload_ok;
  } catch (error) {
    return result;
  }

  return result;
}
