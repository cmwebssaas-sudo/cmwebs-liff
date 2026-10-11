(function (global) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 30000;
  const DEFAULT_RETRY_DELAY_MS = 350;
  const READ_ONLY_ACTIONS = {
    landlord_arrears: true,
    landlord_bill_manual_settlement_status: true,
    landlord_billing_init: true,
    landlord_contract_requests_init: true,
    landlord_home_bootstrap: true,
    landlord_notifications_init: true,
    landlord_payment_reports_init: true,
    landlord_properties_init: true,
    landlord_room_center_init: true,
    landlord_revenue_dashboard_init: true,
    landlord_settings_init: true,
    landlord_tenants: true,
    landlord_workspace_context: true
  };
  const inFlightReads = new Map();

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : fallback;
  }

  function stableParams(params) {
    const source = params || {};
    const output = {};
    Object.keys(source).sort().forEach(function (key) {
      output[key] = source[key];
    });
    return output;
  }

  function requestKey(config, authParams) {
    return JSON.stringify({
      action: config.action,
      auth: authParams.landlord_session_token ||
        authParams.line_user_id ||
        config.lineUserId ||
        '',
      params: stableParams(config.params)
    });
  }

  function makeError(message, code) {
    const error = new Error(message);
    error.code = code || '';
    return error;
  }

  function getAuthParams() {
    if (
      global.CMWebsLandlordAuth &&
      typeof global.CMWebsLandlordAuth.getRequestAuthParams === 'function'
    ) {
      return global.CMWebsLandlordAuth.getRequestAuthParams() || {};
    }
    return {};
  }

  function requestOnce(config, authParams) {
    const action = String(config.action || '');
    const params = config.params || {};
    const timeoutMs = numberOr(config.timeoutMs, DEFAULT_TIMEOUT_MS);

    if (
      authParams.response_mode === 'bridge' &&
      authParams.landlord_session_token &&
      global.CMWebsLandlordAuth &&
      typeof global.CMWebsLandlordAuth.request === 'function'
    ) {
      return global.CMWebsLandlordAuth.request(
        action,
        params,
        { timeoutMs: timeoutMs }
      );
    }

    const requestParams = Object.assign({}, params, authParams);
    if (!requestParams.line_user_id && config.lineUserId) {
      requestParams.line_user_id = config.lineUserId;
    }
    if (!requestParams.line_user_id) {
      return Promise.reject(makeError('缺少 LINE User ID', 'AUTH_REQUIRED'));
    }

    return new Promise(function (resolve, reject) {
      const callbackName =
        String(config.callbackPrefix || '__cmwebs_api_') +
        Date.now() +
        '_' +
        Math.floor(Math.random() * 1000000);
      const script = document.createElement('script');
      let finished = false;
      let timer = null;

      function cleanup() {
        if (timer) {
          clearTimeout(timer);
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        try {
          delete global[callbackName];
        } catch (error) {
          global[callbackName] = undefined;
        }
      }

      function finishWithError(error) {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error);
      }

      global[callbackName] = function (result) {
        if (finished) return;
        finished = true;
        cleanup();

        if (
          global.CMWebsLandlordAuth &&
          typeof global.CMWebsLandlordAuth.handleAuthFailure === 'function' &&
          global.CMWebsLandlordAuth.handleAuthFailure(result)
        ) {
          reject(makeError(
            result && result.message ? result.message : '房東身分已失效',
            result && result.code ? result.code : 'AUTH_REQUIRED'
          ));
          return;
        }

        if (config.rejectOnFailure && (!result || result.success !== true)) {
          reject(makeError(
            result && result.message ? result.message : 'API 操作失敗',
            result && result.code ? result.code : 'API_ERROR'
          ));
          return;
        }
        resolve(result);
      };

      timer = setTimeout(function () {
        finishWithError(makeError('API 載入逾時', 'API_TIMEOUT'));
      }, timeoutMs);

      let url =
        String(config.apiUrl || '') +
        '?v2_action=' +
        encodeURIComponent(action) +
        '&callback=' +
        encodeURIComponent(callbackName) +
        '&_=' +
        Date.now();

      if (config.testMode) {
        url += '&test=1';
      }
      Object.keys(requestParams).forEach(function (key) {
        const value = requestParams[key];
        if (value === undefined || value === null) return;
        url +=
          '&' +
          encodeURIComponent(key) +
          '=' +
          encodeURIComponent(value);
      });

      script.charset = 'UTF-8';
      script.onerror = function () {
        finishWithError(makeError('API 路由載入失敗', 'API_NETWORK_ERROR'));
      };
      script.src = url;
      document.body.appendChild(script);
    });
  }

  function request(config) {
    const options = config || {};
    const action = String(options.action || '');
    const readOnly = READ_ONLY_ACTIONS[action] === true;
    const authParams = getAuthParams();
    const maxAttempts = readOnly
      ? Math.max(1, numberOr(options.maxAttempts, 2))
      : 1;
    const retryDelayMs = numberOr(
      options.retryDelayMs,
      DEFAULT_RETRY_DELAY_MS
    );
    const key = readOnly ? requestKey(options, authParams) : '';

    if (readOnly && inFlightReads.has(key)) {
      return inFlightReads.get(key);
    }

    let attempt = 0;
    const operation = new Promise(function (resolve, reject) {
      function run() {
        attempt += 1;
        requestOnce(options, authParams).then(resolve, function (error) {
          const retryable = Boolean(
            error &&
            (
              error.code === 'API_TIMEOUT' ||
              error.code === 'API_NETWORK_ERROR' ||
              error.message === 'API 載入逾時'
            )
          );
          if (readOnly && retryable && attempt < maxAttempts) {
            setTimeout(run, retryDelayMs);
            return;
          }
          reject(error);
        });
      }
      run();
    });

    if (readOnly) {
      inFlightReads.set(key, operation);
      const clear = function () {
        if (inFlightReads.get(key) === operation) {
          inFlightReads.delete(key);
        }
      };
      operation.then(clear, clear);
    }
    return operation;
  }

  // ---- Read snapshots (ADR 2026-10-11) -------------------------------------
  // The last successful result of a main page read is kept per signed-in
  // identity so the next visit can paint immediately while the real request
  // is still running. Bound to a SHA-256 of the identity, labelled as old on
  // screen, expires after a day, and cleared on logout, authorization failure
  // or any successful write made through this module.
  const SNAPSHOT_STORAGE_KEY = 'cmwebs_landlord_read_cache_v1';
  const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
  const SNAPSHOT_MAX_ENTRY_CHARS = 400000;
  const SNAPSHOT_MAX_TOTAL_CHARS = 1500000;
  const SNAPSHOT_ACTIONS = {
    landlord_arrears: true,
    landlord_properties_init: true,
    landlord_revenue_dashboard_init: true,
    landlord_room_center_init: true,
    landlord_tenants: true
  };
  const AUTH_ERROR_PATTERN = /AUTH|SESSION|FORBIDDEN|PERMISSION|WORKSPACE|MEMBERSHIP/;

  function snapshotStore() {
    try {
      return global.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function clearSnapshots() {
    const store = snapshotStore();
    try {
      if (store) store.removeItem(SNAPSHOT_STORAGE_KEY);
    } catch (error) {}
  }

  function snapshotIdentity() {
    const auth = getAuthParams();
    const raw = auth.landlord_session_token
      ? 'email:' + auth.landlord_session_token
      : auth.line_user_id ? 'line:' + auth.line_user_id : '';
    const subtle = global.crypto && global.crypto.subtle;
    if (!raw || !subtle || typeof TextEncoder === 'undefined') {
      return Promise.resolve('');
    }
    return subtle.digest('SHA-256', new TextEncoder().encode('cmwebs-read-cache:' + raw))
      .then(function (digest) {
        return Array.from(new Uint8Array(digest)).map(function (byte) {
          return byte.toString(16).padStart(2, '0');
        }).join('');
      })
      .catch(function () { return ''; });
  }

  function snapshotKey(action, params) {
    return JSON.stringify({ action: action, params: stableParams(params) });
  }

  function readSnapshotBook(identity) {
    const store = snapshotStore();
    if (!store || !identity) return null;
    try {
      const book = JSON.parse(store.getItem(SNAPSHOT_STORAGE_KEY) || 'null');
      if (!book || book.v !== 1 || book.id !== identity || !book.entries) {
        if (book) clearSnapshots();
        return null;
      }
      return book;
    } catch (error) {
      clearSnapshots();
      return null;
    }
  }

  function getSnapshot(identity, action, params, now) {
    const book = readSnapshotBook(identity);
    const entry = book && book.entries[snapshotKey(action, params)];
    if (!entry) return null;
    const age = (now || Date.now()) - Number(entry.at);
    return age >= 0 && age < SNAPSHOT_TTL_MS && entry.result ? entry : null;
  }

  function putSnapshot(identity, action, params, result, now) {
    const store = snapshotStore();
    if (!store || !identity || SNAPSHOT_ACTIONS[action] !== true || !result || result.success !== true) return;
    try {
      const serialised = JSON.stringify(result);
      if (serialised.length > SNAPSHOT_MAX_ENTRY_CHARS) return;
      const book = readSnapshotBook(identity) || { v: 1, id: identity, entries: {} };
      book.entries[snapshotKey(action, params)] = { at: now || Date.now(), result: result };
      let text = JSON.stringify(book);
      // Drop the oldest pages until the book fits a small storage budget.
      const keys = Object.keys(book.entries).sort(function (a, b) {
        return book.entries[a].at - book.entries[b].at;
      });
      while (text.length > SNAPSHOT_MAX_TOTAL_CHARS && keys.length > 1) {
        delete book.entries[keys.shift()];
        text = JSON.stringify(book);
      }
      store.setItem(SNAPSHOT_STORAGE_KEY, text);
    } catch (error) {
      clearSnapshots();
    }
  }

  function snapshotNotice(state, savedAt) {
    const doc = global.document;
    if (!doc || !doc.body) return;
    let notice = doc.getElementById('cmwebsSnapshotNotice');
    if (state === 'hide') {
      if (notice) notice.remove();
      return;
    }
    if (!notice) {
      notice = doc.createElement('div');
      notice.id = 'cmwebsSnapshotNotice';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);' +
        'transform:translateX(-50%);z-index:900;max-width:calc(100% - 32px);padding:7px 14px;' +
        'border-radius:999px;font:600 12px/1.4 system-ui,sans-serif;box-shadow:0 6px 18px rgba(15,30,54,.18);' +
        'pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      doc.body.appendChild(notice);
    }
    const date = new Date(Number(savedAt));
    const clock = Number.isFinite(date.getTime())
      ? String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
      : '上次';
    notice.style.background = state === 'error' ? '#fde8e7' : '#0f1e36';
    notice.style.color = state === 'error' ? '#8f1f1f' : '#ffffff';
    notice.textContent = state === 'error'
      ? '無法更新，畫面為 ' + clock + ' 的資料'
      : '顯示 ' + clock + ' 的資料・更新中';
  }

  // Paint a matching snapshot through onCached while freshPromise runs, then
  // store the fresh result. Returns freshPromise unchanged, so callers keep
  // their existing success and error handling.
  function snapshot(action, params, freshPromise, onCached) {
    let settled = false;
    let painted = false;
    let savedAt = null;
    const identityPromise = snapshotIdentity();
    identityPromise.then(function (identity) {
      if (settled || typeof onCached !== 'function') return;
      const entry = getSnapshot(identity, action, params);
      if (!entry) return;
      try {
        onCached(entry.result, entry.at);
        painted = true;
        savedAt = entry.at;
        snapshotNotice('stale', entry.at);
      } catch (error) {}
    });
    Promise.resolve(freshPromise).then(function (result) {
      settled = true;
      snapshotNotice('hide');
      if (result && result.success === false && AUTH_ERROR_PATTERN.test(String(result.code || ''))) {
        clearSnapshots();
        return;
      }
      identityPromise.then(function (identity) {
        putSnapshot(identity, action, params, result);
      });
    }, function (error) {
      settled = true;
      if (error && AUTH_ERROR_PATTERN.test(String(error.code || ''))) {
        clearSnapshots();
        snapshotNotice('hide');
      } else if (painted) {
        snapshotNotice('error', savedAt);
      }
    });
    return freshPromise;
  }

  // Background read that only fills the snapshot for a later page visit.
  // Skipped when a snapshot younger than ten minutes already exists, so a
  // landlord bouncing between pages does not multiply backend executions.
  const PREFETCH_FRESH_MS = 10 * 60 * 1000;
  function prefetch(config) {
    const options = config || {};
    const action = String(options.action || '');
    const params = options.params || {};
    if (SNAPSHOT_ACTIONS[action] !== true) return Promise.resolve(null);
    return snapshotIdentity().then(function (identity) {
      if (!identity) return null;
      const entry = getSnapshot(identity, action, params);
      if (entry && Date.now() - Number(entry.at) < PREFETCH_FRESH_MS) return null;
      return snapshot(action, params, request(options), null);
    }).catch(function () {
      return null;
    });
  }

  // ---- LINE SDK on demand ------------------------------------------------
  let liffSdkPromise = null;
  function loadLiffSdk() {
    if (global.liff) return Promise.resolve(global.liff);
    if (liffSdkPromise) return liffSdkPromise;
    liffSdkPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      const timer = setTimeout(function () {
        script.remove();
        reject(makeError('LIFF SDK 載入逾時', 'LIFF_SDK_TIMEOUT'));
      }, 15000);
      script.async = true;
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.onload = function () {
        clearTimeout(timer);
        if (global.liff) resolve(global.liff);
        else reject(makeError('LIFF SDK 無法使用', 'LIFF_SDK_MISSING'));
      };
      script.onerror = function () {
        clearTimeout(timer);
        script.remove();
        reject(makeError('LIFF SDK 載入失敗', 'LIFF_SDK_ERROR'));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      liffSdkPromise = null;
      throw error;
    });
    return liffSdkPromise;
  }

  // ---- Immediate navigation feedback --------------------------------------
  // A thin progress bar appears the moment a landlord taps a page link, so a
  // slow next page never feels like an ignored tap.
  function showNavigationProgress() {
    const doc = global.document;
    if (!doc || !doc.body || doc.getElementById('cmwebsNavProgress')) return;
    const bar = doc.createElement('div');
    bar.id = 'cmwebsNavProgress';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText = 'position:fixed;left:0;top:0;height:3px;width:0;z-index:1000;' +
      'background:linear-gradient(90deg,#06c755,#f2a33a);transition:width 8s cubic-bezier(.1,.7,.2,1);' +
      'pointer-events:none';
    doc.body.appendChild(bar);
    global.requestAnimationFrame(function () {
      bar.style.width = '85%';
    });
    // A tap that did not navigate (dialog, same page) must not leave the bar.
    setTimeout(function () { bar.remove(); }, 12000);
  }

  if (global.document && typeof global.document.addEventListener === 'function') {
    global.document.addEventListener('click', function (event) {
      const target = event.target && event.target.closest
        ? event.target.closest('[onclick*="goPage("], a[href$=".html"], a[href*=".html?"]')
        : null;
      if (!target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (target.getAttribute('target') === '_blank') return;
      showNavigationProgress();
    });
    global.addEventListener('pageshow', function () {
      const bar = global.document.getElementById('cmwebsNavProgress');
      if (bar) bar.remove();
    });
  }

  global.CMWebsLandlordApi = {
    request: function (config) {
      const operation = request(config);
      const action = String(config && config.action || '');
      if (READ_ONLY_ACTIONS[action] !== true) {
        operation.then(function (result) {
          if (!result || result.success !== false) clearSnapshots();
        }, function () {});
      }
      return operation;
    },
    snapshot: snapshot,
    prefetch: prefetch,
    clearSnapshots: clearSnapshots,
    loadLiffSdk: loadLiffSdk
  };
})(window);
