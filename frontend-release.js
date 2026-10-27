/*
 * Update this value only as part of an approved frontend release.
 * It is intentionally stable for the lifetime of a release so page-navigation
 * URLs can reuse the browser cache without changing API cache behavior.
 */
window.CMWEBS_RELEASE_VERSION = '20261027-glass-shell-v1';
// Generated comparison identity survives flags-only asset publications.
window.CMWEBS_READ_COMPARISON_VERSION = "read-f929c46e6e8fb1f660e55b0178dd3357dba8910601e67e0b0a01ea0ff30f0aa6";

// Publish one verified endpoint here only after preceding release gates pass.
window.CMWEBS_READ_API_URL = 'https://cmwebs-read-api.buyhotart.workers.dev';
window.CMWEBS_READ_PATH = {
  home: 'off', revenue: 'off', tenants: 'off', rooms: 'on',
  arrears: 'off', properties: 'off'
};
