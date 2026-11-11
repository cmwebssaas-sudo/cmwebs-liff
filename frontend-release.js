/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261111-assistant-ai-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-f5c817e07a294e485ada20e17a46373fc25c6bb2b019197895f231b3666c6d6a";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = 'https://cmwebs-read-api.buyhotart.workers.dev';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'on', rooms: 'on',
  arrears: 'off', properties: 'off'
};
