/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261012-read-cutover-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-c3a409307cbc73b73d6b979293b90b9eee9ac31383c857761d87b584326554d6";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = '';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'off', rooms: 'off',
  arrears: 'off', properties: 'off'
};
