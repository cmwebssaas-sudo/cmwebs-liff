(function (global) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 30000;
  const DEFAULT_RETRY_DELAY_MS = 350;
  const READ_ONLY_ACTIONS = {
    landlord_arrears: true,
    landlord_billing_init: true,
    landlord_contract_requests_init: true,
    landlord_home_bootstrap: true,
    landlord_notifications_init: true,
    landlord_payment_reports_init: true,
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

  global.CMWebsLandlordApi = {
    request: request
  };
})(window);
