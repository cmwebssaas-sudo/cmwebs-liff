/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261113-assistant-data-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-542d1d10477ee125c24edbd85669aebe3d75ec7d26980c6b5eff3a9f879ee09b";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = 'https://cmwebs-read-api.buyhotart.workers.dev';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'on', rooms: 'on',
  arrears: 'off', properties: 'off'
};
