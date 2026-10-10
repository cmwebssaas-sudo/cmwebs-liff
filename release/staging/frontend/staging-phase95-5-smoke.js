(function () {
  'use strict';

  var ROLE_ACTIONS = Object.freeze({
    tenant: [
      'tenant_home',
      'tenant_bills',
      'tenant_contract_init'
    ],
    landlord: [
      'landlord_home',
      'landlord_contracts_init',
      'landlord_billing_lifecycle_init'
    ]
  });

  var CROSS_ROLE_ACTION = Object.freeze({
    tenant: 'landlord_home',
    landlord: 'tenant_home'
  });

  function succeeded(payload) {
    return Boolean(payload && (payload.success === true || payload.ok === true));
  }

  function safeCode(payload) {
    return String(payload && (payload.code || payload.message) || 'NO_CODE')
      .slice(0, 120);
  }

  function render(role, results) {
    var passed = results.every(function (item) { return item.pass; });
    document.body.innerHTML = '';
    var main = document.createElement('main');
    main.style.cssText = 'max-width:720px;margin:32px auto;padding:20px;font-family:system-ui,sans-serif';
    var title = document.createElement('h1');
    title.textContent = 'Phase 95.5 ' + role + ' smoke: ' + (passed ? 'PASS' : 'FAIL');
    main.appendChild(title);
    results.forEach(function (item) {
      var row = document.createElement('p');
      row.textContent = (item.pass ? 'PASS ' : 'FAIL ') + item.action + ' — ' + item.code;
      main.appendChild(row);
    });
    document.body.appendChild(main);
  }

  window.cmwebsRunPhase955Smoke = async function (options) {
    options = options || {};
    var role = String(options.role || '');
    var requested = new URLSearchParams(location.search).get('phase95_5');
    if (requested !== role) return false;
    if (!ROLE_ACTIONS[role] || typeof options.request !== 'function') {
      throw new Error('PHASE95_5_SMOKE_CONFIGURATION_INVALID');
    }

    var results = [];
    for (var index = 0; index < ROLE_ACTIONS[role].length; index += 1) {
      var action = ROLE_ACTIONS[role][index];
      var payload = await options.request(action, {});
      results.push({ action: action, pass: succeeded(payload), code: safeCode(payload) });
    }

    var crossAction = CROSS_ROLE_ACTION[role];
    var crossPayload = await options.request(crossAction, {});
    results.push({
      action: crossAction + ' (cross-role denied)',
      pass: !succeeded(crossPayload),
      code: safeCode(crossPayload)
    });
    render(role, results);
    return true;
  };
}());
