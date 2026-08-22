(function (root, factory) {
  const actions = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = actions;
  }

  if (root) {
    root.CMWebsDocumentMobileActions = actions;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function shouldUseSystemFileMenu(options) {
    const settings = options || {};
    const navigatorRef =
      settings.navigatorRef ||
      (typeof navigator !== 'undefined' ? navigator : null);
    const liffRef =
      settings.liffRef ||
      (typeof globalThis !== 'undefined' ? globalThis.liff : null);

    if (!navigatorRef || typeof navigatorRef.share !== 'function') {
      return false;
    }

    const userAgent = String(navigatorRef.userAgent || '');
    const isLineUserAgent = /(?:^|[\s;])Line\/[\d.]+/i.test(userAgent);
    let isLiffClient = false;

    try {
      isLiffClient = Boolean(
        liffRef &&
        typeof liffRef.isInClient === 'function' &&
        liffRef.isInClient()
      );
    } catch (error) {
      isLiffClient = false;
    }

    return isLineUserAgent || isLiffClient;
  }

  async function openSystemFileMenu(options) {
    const settings = options || {};
    const navigatorRef =
      settings.navigatorRef ||
      (typeof navigator !== 'undefined' ? navigator : null);
    const FileCtor =
      settings.FileCtor ||
      (typeof File !== 'undefined' ? File : null);
    const blob = settings.blob;
    const fileName = String(settings.fileName || 'document');

    if (!navigatorRef || typeof navigatorRef.share !== 'function') {
      throw new Error('此瀏覽器不支援手機檔案選單');
    }

    if (!FileCtor || !blob) {
      throw new Error('目前文件無法準備分享');
    }

    const file = new FileCtor(
      [blob],
      fileName,
      { type: blob.type || 'application/octet-stream' }
    );
    const shareData = {
      title: fileName || 'CMWebs 文件',
      files: [file]
    };

    if (
      typeof navigatorRef.canShare === 'function' &&
      !navigatorRef.canShare(shareData)
    ) {
      throw new Error('此瀏覽器不支援檔案分享');
    }

    await navigatorRef.share(shareData);
  }

  return {
    shouldUseSystemFileMenu,
    openSystemFileMenu
  };
});
