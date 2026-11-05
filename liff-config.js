(function (global) {
  'use strict';
  // The existing CMWebs LINE Login channel. Older pages keep their own LIFF
  // apps until they are retired.
  const EXISTING_LIFF_IDS = Object.freeze({
    landlord: '2010314940-EjX1qbb8',
    tenant: '2010314940-iJB1D6sN',
    announce: '2010314940-t4iSUI07',
    batch_meter: '2010314940-X9jVnrKv',
    checkout: '2010314940-MkgP1rlT',
    hub: '2010314940-UNt5Lu1D',
    identity: '2010314940-WndrUM1J',
    index: '2010314940-at3zGKFb',
    landlord_legacy: '2010314940-WzSb8nmq',
    landlord_registry: '2010314940-jMdgTriP',
    meter: '2010314940-tfcy6cEx',
    new_lease: '2010314940-hsmAUnNw',
    tenant_checkin: '2010314940-5A3pViKf'
  });
  // A landlord's own LIFF app opens CMWebs with its LIFF ID in the endpoint
  // URL. The tab keeps it, because in-app links drop the query string. The
  // server decides access from the ID token's channel, never from this value.
  const PARAM = 'cmwebs_liff';
  const STORAGE_KEY = 'cmwebs_workspace_liff_id';
  const PATTERN = /^\d{10}-[A-Za-z0-9]{8}$/;

  function storage() {
    try {
      return global.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function workspaceLiffId() {
    let requested = '';
    try {
      requested = new URL(global.location.href).searchParams.get(PARAM) || '';
    } catch (error) {}
    const store = storage();
    if (PATTERN.test(requested)) {
      try { if (store) store.setItem(STORAGE_KEY, requested); } catch (error) {}
      return requested;
    }
    let stored = '';
    try { stored = store ? String(store.getItem(STORAGE_KEY) || '') : ''; } catch (error) {}
    return PATTERN.test(stored) ? stored : '';
  }

  function liffId(app) {
    if (!Object.prototype.hasOwnProperty.call(EXISTING_LIFF_IDS, app)) {
      throw new Error('UNKNOWN_LIFF_APP');
    }
    return workspaceLiffId() || EXISTING_LIFF_IDS[app];
  }

  global.CMWebsLiffConfig = Object.freeze({
    liffId: liffId,
    workspaceLiffId: workspaceLiffId,
    existingLiffIds: EXISTING_LIFF_IDS
  });
})(window);
