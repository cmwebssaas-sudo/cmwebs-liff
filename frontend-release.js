/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261110-pay-calendar-room-order-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-1e89390cc2f4ee1c26f6dc9f2a8110c17a1023b41831836d954f22143043116c";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = 'https://cmwebs-read-api.buyhotart.workers.dev';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'on', rooms: 'on',
  arrears: 'off', properties: 'off'
};
