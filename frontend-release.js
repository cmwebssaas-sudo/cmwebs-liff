/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261012-read-cutover-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-73dcf823e4cca15270bce2c42972cac1ba8f29e5fcbafcf3d345f28123941f8b";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = '';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'off', rooms: 'off',
  arrears: 'off', properties: 'off'
};
