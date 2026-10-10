(function () {
  'use strict';

  function hidden(form, name, value) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value === undefined || value === null ? '' : value);
    form.appendChild(input);
  }

  function isAppsScriptBridgeOrigin(origin) {
    try {
      var parsed = new URL(String(origin || ''));
      return parsed.protocol === 'https:' && (
        parsed.hostname === 'script.google.com' ||
        /^[a-z0-9-]+-script\.googleusercontent\.com$/i.test(parsed.hostname)
      );
    } catch (error) {
      return false;
    }
  }

  window.cmwebsSecureBridgeRequest = function (options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      if (!window.liff || typeof window.liff.getIDToken !== 'function') {
        reject(new Error('LIFF identity is unavailable'));
        return;
      }
      var idToken = window.liff.getIDToken();
      if (!idToken) {
        reject(new Error('LINE 登入憑證不存在，請重新登入'));
        return;
      }

      var requestId = 'cmwebs_secure_' + Date.now() + '_' +
        Math.floor(Math.random() * 1000000);
      var frame = document.createElement('iframe');
      var form = document.createElement('form');
      var frameName = requestId + '_frame';
      var finished = false;
      var timeoutMs = Math.max(5000, Number(options.timeoutMs) || 30000);

      frame.name = frameName;
      frame.hidden = true;
      form.method = 'POST';
      form.action = String(options.apiUrl || '');
      form.target = frameName;
      form.hidden = true;

      hidden(form, 'v2_action', options.action || '');
      hidden(form, 'id_token', idToken);
      hidden(form, 'bridge', '1');
      hidden(form, 'request_id', requestId);
      if (options.testMode) hidden(form, 'test', '1');
      Object.keys(options.params || {}).forEach(function (key) {
        var value = options.params[key];
        if (value !== undefined && value !== null) hidden(form, key, value);
      });

      function cleanup() {
        window.removeEventListener('message', onMessage);
        if (form.parentNode) form.parentNode.removeChild(form);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }
      function finish(error, payload) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cleanup();
        if (error) reject(error); else resolve(payload || {});
      }
      function onMessage(event) {
        var envelope = event && event.data;
        if (!event || !isAppsScriptBridgeOrigin(event.origin)) return;
        if (!envelope || envelope.source !== 'CMWEBS_APPS_SCRIPT') return;
        if (envelope.requestId !== requestId) return;
        finish(null, envelope.payload);
      }

      var timer = setTimeout(function () {
        var error = new Error('API 載入逾時');
        error.code = 'API_TIMEOUT';
        finish(error);
      }, timeoutMs);

      window.addEventListener('message', onMessage);
      document.body.appendChild(frame);
      document.body.appendChild(form);
      form.submit();
    });
  };
}());
