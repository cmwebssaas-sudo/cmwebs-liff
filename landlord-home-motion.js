/* Homepage-only presentation. No requests, credentials or financial data. */
window.CMWebsHomeMotion = (function () {
  let manualPaused = false;
  let cleanup = function () {};

  function unmount() {
    cleanup();
    cleanup = function () {};
  }

  function mount(host) {
    unmount();
    if (!host) return;
    const button = host.querySelector('[data-motion-toggle]');
    const status = host.querySelector('[data-motion-status]');
    if (!button || !status) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let entranceSettled = false;

    function update() {
      const reduced = media.matches;
      // Once a user/system requests a static chart, never hide its geometry again.
      entranceSettled = entranceSettled || reduced || manualPaused;
      const state = reduced ? 'reduced' : manualPaused ? 'paused' :
        document.hidden || !visible ? 'suspended' : 'running';
      host.setAttribute('data-motion', state);
      host.setAttribute('data-motion-entrance', entranceSettled ? 'settled' : 'initial');
      host.setAttribute('data-motion-ready', 'true');
      button.disabled = reduced;
      button.setAttribute('aria-pressed', String(manualPaused || reduced));
      button.textContent = reduced ? '已減少動態' : manualPaused ? '播放動畫' : '暫停動畫';
      status.textContent = reduced ? '依裝置設定顯示靜態圖表' :
        manualPaused ? '圖表已暫停，數據不受影響' : '圓環緩慢旋轉 · 數據保持固定';
    }

    function toggle() {
      if (media.matches) return;
      manualPaused = !manualPaused;
      update();
    }

    button.addEventListener('click', toggle);
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    const observer = window.IntersectionObserver ? new window.IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      update();
    }) : null;
    if (observer) observer.observe(host);
    cleanup = function () {
      button.removeEventListener('click', toggle);
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
      if (observer) observer.disconnect();
    };
    update();
  }

  return { mount: mount, unmount: unmount };
})();
