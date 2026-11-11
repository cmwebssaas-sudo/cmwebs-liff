/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261112-assistant-chat-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-e6fa4664152a6b037ec0bb0bab62387e021b3c56dd5f86124b44d4a6077f4d4d";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = 'https://cmwebs-read-api.buyhotart.workers.dev';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'on', rooms: 'on',
  arrears: 'off', properties: 'off'
};
