(function () {
  'use strict';

  const SESSION_TOKEN_KEY =
    'cmwebs_landlord_session_token';
  const AUTH_FAILURE_CODES = {
    SESSION_EXPIRED: true,
    AUTH_REQUIRED: true,
    WORKSPACE_FORBIDDEN: true
  };
  const BRIDGE_TIMEOUT_MS = 25000;

  let config = {
    apiUrl: '',
    liffId: '',
    lineUserId: '',
    returnTo: '',
    entryPage: 'landlord-entry.html'
  };

  function text(value) {
    return value === undefined || value === null
      ? ''
      : String(value);
  }

  function storage() {
    try {
      return window.sessionStorage || null;
    } catch (error) {
      return null;
    }
  }

  function getSessionToken() {
    const store = storage();
    return store
      ? text(store.getItem(SESSION_TOKEN_KEY))
      : '';
  }

  function setSessionToken(token) {
    const store = storage();
    if (!store) return;
    if (token) {
      store.setItem(SESSION_TOKEN_KEY, token);
    } else {
      store.removeItem(SESSION_TOKEN_KEY);
    }
  }

  function isDesktop() {
    if (
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches
    ) {
      return true;
    }
    return Number(window.innerWidth || 0) >= 1024;
  }

  function requestId() {
    const random =
      Math.random()
        .toString(36)
        .slice(2);
    return 'cmwebs_auth_' + Date.now() + '_' + random;
  }

  function appendField(form, name, value) {
    const input =
      document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = text(value);
    form.appendChild(input);
  }

  function cleanupBridge(iframe, form, listener, timer) {
    clearTimeout(timer);
    window.removeEventListener('message', listener);
    if (form && form.parentNode) {
      form.parentNode.removeChild(form);
    }
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }

  function bridgePost(action, params) {
    if (!config.apiUrl) {
      return Promise.reject(
        new Error('API_URL_REQUIRED')
      );
    }

    const id =
      requestId();
    const iframe =
      document.createElement('iframe');
    const form =
      document.createElement('form');
    const payload =
      Object.assign(
        {},
        params || {},
        {
          action: action,
          v2_action: action,
          response_mode: 'bridge',
          request_id: id
        }
      );

    iframe.name =
      'cmwebs_landlord_auth_' + id;
    iframe.hidden =
      true;
    iframe.style.display =
      'none';

    form.method =
      'POST';
    form.action =
      config.apiUrl;
    form.target =
      iframe.name;
    form.style.display =
      'none';

    Object.keys(payload).forEach(function (key) {
      appendField(form, key, payload[key]);
    });

    return new Promise(function (resolve, reject) {
      let finished = false;
      const timer =
        setTimeout(function () {
          if (finished) return;
          finished = true;
          cleanupBridge(iframe, form, listener, timer);
          reject(new Error('API 載入逾時'));
        }, BRIDGE_TIMEOUT_MS);

      function listener(event) {
        const data =
          event && event.data
            ? event.data
            : {};
        if (
          data.source !== 'CMWEBS_APPS_SCRIPT' ||
          data.requestId !== id
        ) {
          return;
        }

        finished = true;
        cleanupBridge(iframe, form, listener, timer);

        const result =
          data.payload || {};
        const code =
          text(result.code);
        if (
          result.success !== true &&
          AUTH_FAILURE_CODES[code]
        ) {
          setSessionToken('');
          redirectToEntry();
        }

        if (result.success === true) {
          resolve(result);
        } else {
          const error =
            new Error(
              result.message ||
              code ||
              'API 路由執行失敗'
            );
          error.code = code;
          reject(error);
        }
      }

      window.addEventListener('message', listener);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
  }

  function validatedReturnTo(value) {
    const candidate =
      text(value || config.returnTo);
    if (!candidate) return '';

    try {
      const url =
        new URL(candidate, window.location.href);
      const allowedPrefix =
        window.location.pathname.replace(/[^/]+$/, '') +
        'landlord-';
      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith(allowedPrefix) ||
        url.pathname.endsWith('/landlord-entry.html')
      ) {
        return '';
      }

      [
        'code',
        'state',
        'liff.state',
        'friendship_status_changed',
        'error',
        'error_description'
      ].forEach(function (key) {
        url.searchParams.delete(key);
      });

      return (
        url.pathname.split('/').pop() +
        (
          url.searchParams.toString()
            ? '?' + url.searchParams.toString()
            : ''
        ) +
        (url.hash || '')
      );
    } catch (error) {
      return '';
    }
  }

  function redirectToEntry(message) {
    const entry =
      config.entryPage || 'landlord-entry.html';
    const params =
      new URLSearchParams();
    const returnTo =
      validatedReturnTo(config.returnTo);
    if (returnTo) {
      params.set('return_to', returnTo);
    }
    if (message) {
      params.set('auth_error', text(message));
    }
    const target =
      entry +
      (
        params.toString()
          ? '?' + params.toString()
          : ''
      );
    window.location.replace(target);
  }

  function maybeStoreSession(result) {
    const data =
      result && result.data
        ? result.data
        : {};
    const token =
      text(data.session_token);
    if (token) {
      setSessionToken(token);
    }
    return result;
  }

  const api = {
    init(options) {
      config =
        Object.assign(
          {},
          config,
          options || {}
        );
      return api;
    },

    getMode() {
      if (getSessionToken()) {
        return 'email';
      }
      return isDesktop()
        ? 'email'
        : 'line';
    },

    getRequestAuthParams() {
      const token =
        getSessionToken();
      if (token) {
        return {
          response_mode: 'bridge',
          landlord_session_token: token
        };
      }
      return {
        line_user_id:
          text(config.lineUserId)
      };
    },

    requestEmailCode(email) {
      return bridgePost(
        'landlord_email_login_request',
        {
          email: text(email).trim()
        }
      );
    },

    verifyEmailCode(challengeId, code) {
      return bridgePost(
        'landlord_email_login_verify',
        {
          challenge_id: text(challengeId).trim(),
          code: text(code).trim()
        }
      ).then(maybeStoreSession);
    },

    requestEmailVerification(email) {
      return bridgePost(
        'landlord_email_verify_request',
        {
          line_user_id: text(config.lineUserId),
          email: text(email).trim()
        }
      );
    },

    verifyEmailVerification(challengeId, code) {
      return bridgePost(
        'landlord_email_verify_code',
        {
          line_user_id: text(config.lineUserId),
          challenge_id: text(challengeId).trim(),
          code: text(code).trim()
        }
      );
    },

    getSessionStatus() {
      return bridgePost(
        'landlord_email_session_status',
        {
          landlord_session_token: getSessionToken()
        }
      );
    },

    logout() {
      const token =
        getSessionToken();
      setSessionToken('');
      if (!token) {
        return Promise.resolve({
          success: true,
          code: 'OK'
        });
      }
      return bridgePost(
        'landlord_email_session_revoke',
        {
          landlord_session_token: token
        }
      ).catch(function () {
        return {
          success: true,
          code: 'LOCAL_SESSION_CLEARED'
        };
      });
    }
  };

  window.CMWebsLandlordAuth = api;
})();
